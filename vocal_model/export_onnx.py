"""
Export Mel-Band RoFormer model to ONNX format for optimized CPU inference.

This script exports the PyTorch model to ONNX with optimizations for faster CPU execution.
ONNX Runtime can provide 2-5x speedup over PyTorch CPU inference.
"""
import argparse
import os
import torch
from pathlib import Path
from omegaconf import OmegaConf
from safetensors.torch import load_file
from mel_band_roformer import MelBandRoformer


def export_to_onnx(
    model_path: str,
    config_path: str,
    output_path: str,
    opset_version: int = 17,
    optimize: bool = True
):
    """
    Export the Mel-Band RoFormer model to ONNX format.

    Args:
        model_path: Path to the .safetensors model file
        config_path: Path to the config.yaml file
        output_path: Path to save the .onnx model
        opset_version: ONNX opset version (17 recommended for best optimization)
        optimize: Whether to apply ONNX optimizations
    """
    print(f"Loading configuration from: {config_path}")
    config = OmegaConf.load(config_path)
    config_dict = OmegaConf.to_container(config, resolve=True)

    # Convert list to tuple for multi_stft_resolutions_window_sizes
    if 'multi_stft_resolutions_window_sizes' in config_dict['model']:
        config_dict['model']['multi_stft_resolutions_window_sizes'] = tuple(
            config_dict['model']['multi_stft_resolutions_window_sizes']
        )

    print("Instantiating Mel-Band RoFormer model...")
    model = MelBandRoformer(**config_dict['model'])

    print(f"Loading model weights from: {model_path}")
    state_dict = load_file(model_path, device='cpu')
    model.load_state_dict(state_dict)
    model.eval()

    # Create dummy input - stereo audio chunk
    chunk_size = config_dict['audio']['chunk_size']
    dummy_input = torch.randn(1, 2, chunk_size)  # [batch, channels, samples]

    print(f"Exporting to ONNX (opset {opset_version})...")
    print(f"Input shape: {dummy_input.shape}")

    # Export with optimization
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=optimize,
        input_names=['audio_input'],
        output_names=['vocals_output'],
        dynamic_axes={
            'audio_input': {0: 'batch', 2: 'samples'},
            'vocals_output': {0: 'batch', 2: 'samples'}
        }
    )

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nExport complete!")
    print(f"ONNX model saved to: {output_path}")
    print(f"File size: {file_size:.2f} MB")

    if optimize:
        print("\nApplying ONNX optimizations...")
        try:
            import onnx
            from onnxruntime.transformers import optimizer

            # Load and optimize
            onnx_model = onnx.load(output_path)
            optimized_model = optimizer.optimize_model(
                output_path,
                model_type='bert',  # Use transformer optimizations
                num_heads=config_dict['model']['heads'],
                hidden_size=config_dict['model']['dim']
            )

            optimized_path = output_path.replace('.onnx', '_optimized.onnx')
            optimized_model.save_model_to_file(optimized_path)

            optimized_size = os.path.getsize(optimized_path) / (1024 * 1024)
            print(f"Optimized model saved to: {optimized_path}")
            print(f"Optimized size: {optimized_size:.2f} MB")
        except ImportError:
            print("onnxruntime.transformers not available - skipping advanced optimizations")
            print("Install with: pip install onnxruntime onnx")


def main():
    parser = argparse.ArgumentParser(
        description="Export Mel-Band RoFormer to ONNX format"
    )
    parser.add_argument(
        "--model_path",
        type=str,
        default="model_vocals_tommy.safetensors",
        help="Path to the .safetensors model file"
    )
    parser.add_argument(
        "--config_path",
        type=str,
        default="config_vocals_tommy.yaml",
        help="Path to the config.yaml file"
    )
    parser.add_argument(
        "--output_path",
        type=str,
        default="model_vocals_tommy.onnx",
        help="Output path for the ONNX model"
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version (default: 17)"
    )
    parser.add_argument(
        "--no-optimize",
        action="store_true",
        help="Disable ONNX optimizations"
    )

    args = parser.parse_args()

    export_to_onnx(
        model_path=args.model_path,
        config_path=args.config_path,
        output_path=args.output_path,
        opset_version=args.opset,
        optimize=not args.no_optimize
    )


if __name__ == "__main__":
    main()
