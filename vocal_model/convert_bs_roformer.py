"""
Convert BS-Roformer checkpoint (.ckpt) to safetensors format.
"""
import torch
from safetensors.torch import save_file
import argparse
from pathlib import Path

def convert_checkpoint(ckpt_path: str, output_path: str):
    """
    Convert a PyTorch Lightning checkpoint to safetensors format.

    Args:
        ckpt_path: Path to the .ckpt file
        output_path: Path to save the .safetensors file
    """
    print(f"Loading checkpoint: {ckpt_path}")

    # Load the checkpoint
    checkpoint = torch.load(ckpt_path, map_location='cpu')

    # Extract the state dict
    # PyTorch Lightning saves models with 'state_dict' key
    if 'state_dict' in checkpoint:
        state_dict = checkpoint['state_dict']
        print("Found state_dict in checkpoint")
    else:
        state_dict = checkpoint
        print("Using checkpoint directly as state_dict")

    # Remove any 'model.' prefix if present (common in Lightning checkpoints)
    # Also clone tensors to avoid shared memory issues
    cleaned_state_dict = {}
    for key, value in state_dict.items():
        if key.startswith('model.'):
            cleaned_key = key[6:]  # Remove 'model.' prefix
        else:
            cleaned_key = key
        # Clone to create separate memory for each tensor
        cleaned_state_dict[cleaned_key] = value.clone()

    print(f"State dict contains {len(cleaned_state_dict)} parameters")
    print(f"Sample keys: {list(cleaned_state_dict.keys())[:5]}")

    # Save to safetensors format
    print(f"Saving to: {output_path}")
    save_file(cleaned_state_dict, output_path)

    print("Conversion complete!")

    # Print file sizes for comparison
    import os
    ckpt_size = os.path.getsize(ckpt_path) / (1024 * 1024)
    safetensors_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Original size: {ckpt_size:.1f} MB")
    print(f"Safetensors size: {safetensors_size:.1f} MB")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert BS-Roformer checkpoint to safetensors")
    parser.add_argument(
        "--input",
        type=str,
        default="model_bs_roformer_ep_317_sdr_12.9755.ckpt",
        help="Path to input .ckpt file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="model_bs_roformer_ep_317_sdr_12.9755.safetensors",
        help="Path to output .safetensors file"
    )

    args = parser.parse_args()

    convert_checkpoint(args.input, args.output)
