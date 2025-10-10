"""
Convert MelBandRoformer checkpoint to safetensors format.
Optionally apply dynamic quantization for faster CPU inference.
"""
import torch
import yaml
import argparse
from omegaconf import OmegaConf
from safetensors.torch import save_file
from vocal_model.mel_band_roformer import MelBandRoformer

def convert_checkpoint_to_safetensors(quantize=False):
    # Load config
    config_path = "vocal_model/config.yaml"
    config = OmegaConf.load(config_path)

    # Convert to container to handle OmegaConf types
    config_dict = OmegaConf.to_container(config, resolve=True)

    # Convert list to tuple for multi_stft_resolutions_window_sizes
    if 'multi_stft_resolutions_window_sizes' in config_dict['model']:
        config_dict['model']['multi_stft_resolutions_window_sizes'] = tuple(
            config_dict['model']['multi_stft_resolutions_window_sizes']
        )

    # Initialize model
    print("Initializing model architecture...")
    model = MelBandRoformer(**config_dict['model'])

    # Load checkpoint
    ckpt_path = "vocal_model/melband_roformer_model/MelBandRoformer.ckpt"
    print(f"Loading checkpoint from {ckpt_path}...")
    checkpoint = torch.load(ckpt_path, map_location='cpu')

    # Extract state dict (handle different checkpoint formats)
    if 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
    else:
        state_dict = checkpoint

    # Load weights into model
    print("Loading weights into model...")
    model.load_state_dict(state_dict)
    model.eval()

    # Apply dynamic quantization if requested
    if quantize:
        print("Applying dynamic quantization (int8)...")
        print("This will reduce model size and speed up CPU inference.")
        model = torch.quantization.quantize_dynamic(
            model,
            {torch.nn.Linear},
            dtype=torch.qint8
        )
        output_path = "vocal_model/melband_roformer_vocals_quantized.safetensors"
    else:
        output_path = "vocal_model/melband_roformer_vocals.safetensors"

    # Save as safetensors
    # Clone the state dict to avoid shared memory issues
    print(f"Saving to {output_path}...")
    state_dict = {k: v.clone() for k, v in model.state_dict().items()}
    save_file(state_dict, output_path)

    print("✓ Conversion complete!")
    print(f"Model saved to: {output_path}")
    if quantize:
        print("Note: Quantized model is optimized for CPU inference")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert checkpoint to safetensors")
    parser.add_argument("--quantize", action="store_true", help="Apply dynamic quantization for faster CPU inference")
    args = parser.parse_args()

    convert_checkpoint_to_safetensors(quantize=args.quantize)
