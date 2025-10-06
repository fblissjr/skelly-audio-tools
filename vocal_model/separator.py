import argparse
import os
import glob
import torch
import torch.nn.functional as F
import librosa
import soundfile as sf
import yaml
from tqdm import tqdm
from omegaconf import OmegaConf
from safetensors.torch import load_file

# Local imports for the model architecture
from .mel_band_roformer import MelBandRoformer


class VocalSeparator:
    """
    A class to encapsulate the Mel-Band RoFormer model for vocal separation.
    It provides a high-level API for loading the model and processing audio files.
    """

    def __init__(self, model_path: str, config_path: str = None, device: str = None):
        """
        Initializes the VocalSeparator.

        Args:
            model_path (str): Path to the .safetensors model file.
            config_path (str, optional): Path to the config.yaml file.
                                         If None, uses the default config in this package.
            device (str, optional): The device to run the model on ('cuda' or 'cpu').
                                    Auto-detects if None.
        """
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        print(f"Using device: {self.device}")

        if config_path is None:
            # Use the default config file included with the package
            config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

        print(f"Loading configuration from: {config_path}")
        with open(config_path) as f:
            self.config = OmegaConf.create(yaml.safe_load(f))

        print("Instantiating model...")
        self.model = MelBandRoformer(**self.config.model).to(self.device)

        print(f"Loading model weights from: {model_path}")
        state_dict = load_file(model_path, device=self.device)
        self.model.load_state_dict(state_dict)
        self.model.eval()

    def _get_windowing_array(self, window_size, fade_size):
        """Creates a fade-in/fade-out window for smooth chunk transitions."""
        fadein = torch.linspace(0, 1, fade_size)
        fadeout = torch.linspace(1, 0, fade_size)
        window = torch.ones(window_size)
        window[-fade_size:] *= fadeout
        window[:fade_size] *= fadein
        return window.to(self.device)

    def separate(self, audio_tensor: torch.Tensor) -> torch.Tensor:
        """
        Performs vocal separation on a pre-loaded audio tensor.

        Args:
            audio_tensor (torch.Tensor): A stereo audio tensor of shape [2, samples].
                                         Must be at the model's target sample rate (44100 Hz).

        Returns:
            torch.Tensor: A stereo tensor of the separated vocals.
        """
        C = self.config.inference.chunk_size
        N = self.config.inference.num_overlap
        step = C // N
        fade_size = C // 10
        border = C - step

        mix = audio_tensor
        if mix.shape[1] > 2 * border and border > 0:
            mix = F.pad(mix, (border, border), mode="reflect")

        windowing_array = self._get_windowing_array(C, fade_size)

        result = torch.zeros_like(mix, device=self.device)
        counter = torch.zeros_like(mix, device=self.device)

        with (
            torch.no_grad(),
            torch.cuda.amp.autocast(enabled=self.device.type == "cuda"),
        ):
            total_length = mix.shape[1]
            for i in tqdm(
                range(0, total_length, step), desc="Separating", unit="chunk"
            ):
                part = mix[:, i : i + C]
                length = part.shape[-1]

                if length < C:
                    part = F.pad(input=part, pad=(0, C - length), mode="reflect")

                # Model expects a batch dimension
                processed_chunk = self.model(part.unsqueeze(0))[0]

                result[:, i : i + length] += (
                    processed_chunk[:, :length] * windowing_array[:length]
                )
                counter[:, i : i + length] += windowing_array[:length]

        estimated_vocals = result / counter

        if mix.shape[1] > 2 * border and border > 0:
            estimated_vocals = estimated_vocals[:, border:-border]

        return estimated_vocals

    def separate_file(
        self, input_path: str, output_vocals_path: str, output_inst_path: str = None
    ):
        """
        Loads an audio file, separates the vocals, and saves the output.

        Args:
            input_path (str): Path to the input audio file.
            output_vocals_path (str): Path to save the separated vocals.
            output_inst_path (str, optional): Path to save the instrumental track.
        """
        print(f"Processing file: {input_path}")
        target_sr = self.config.model.sample_rate

        try:
            wav, sr = librosa.load(input_path, sr=None, mono=False)
        except Exception as e:
            print(f"ERROR: Could not load audio file {input_path}. Reason: {e}")
            return

        original_tensor = torch.from_numpy(wav)

        if original_tensor.dim() == 1:
            original_tensor = original_tensor.unsqueeze(0)

        if original_tensor.shape[0] == 1:
            original_tensor = original_tensor.repeat(2, 1)

        if sr != target_sr:
            print(f"Resampling from {sr} Hz to {target_sr} Hz...")
            resampler = librosa.resample(
                original_tensor.numpy(), orig_sr=sr, target_sr=target_sr
            )
            original_tensor = torch.from_numpy(resampler)

        vocals_tensor = self.separate(original_tensor.to(self.device))

        print(f"Saving vocals to: {output_vocals_path}")
        sf.write(output_vocals_path, vocals_tensor.cpu().numpy().T, target_sr)

        if output_inst_path:
            print(f"Calculating and saving instrumental to: {output_inst_path}")
            instrumental_tensor = original_tensor - vocals_tensor.cpu()
            sf.write(output_inst_path, instrumental_tensor.numpy().T, target_sr)

    def separate_folder(self, input_folder: str, output_folder: str):
        """
        Separates vocals for all .wav and .mp3 files in a folder.
        """
        if not os.path.isdir(output_folder):
            os.makedirs(output_folder)

        audio_files = glob.glob(os.path.join(input_folder, "*.wav")) + glob.glob(
            os.path.join(input_folder, "*.mp3")
        )

        if not audio_files:
            print(f"No .wav or .mp3 files found in '{input_folder}'")
            return

        for audio_path in audio_files:
            base_name = os.path.splitext(os.path.basename(audio_path))[0]
            output_vocals = os.path.join(output_folder, f"{base_name}_vocals.wav")
            output_inst = os.path.join(output_folder, f"{base_name}_instrumental.wav")
            self.separate_file(audio_path, output_vocals, output_inst)
            print("-" * 40)


def main():
    """Command-line interface for the Vocal Separator."""
    parser = argparse.ArgumentParser(
        description="A standalone tool for separating vocals from audio using Mel-Band RoFormer.",
        formatter_class=argparse.RawTextHelpFormatter,
    )
    parser.add_argument(
        "--model_path",
        type=str,
        required=True,
        help="Path to the .safetensors model file.",
    )
    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Path to an input audio file or a folder of audio files.",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=".",
        help="Directory to save the output files.",
    )
    parser.add_argument(
        "--config_path",
        type=str,
        default=None,
        help="Path to a custom config.yaml file (optional).",
    )

    args = parser.parse_args()

    try:
        separator = VocalSeparator(
            model_path=args.model_path, config_path=args.config_path
        )

        if os.path.isdir(args.input):
            separator.separate_folder(args.input, args.output_dir)
        elif os.path.isfile(args.input):
            base_name = os.path.splitext(os.path.basename(args.input))[0]
            output_vocals = os.path.join(args.output_dir, f"{base_name}_vocals.wav")
            output_inst = os.path.join(args.output_dir, f"{base_name}_instrumental.wav")
            separator.separate_file(args.input, output_vocals, output_inst)
        else:
            print(f"Error: Input path '{args.input}' is not a valid file or directory.")

    except Exception as e:
        print(f"\nAn error occurred: {e}")


if __name__ == "__main__":
    main()
