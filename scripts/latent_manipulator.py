import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModelForCausalLM
import argparse
import sys

# --- 1. Autoencoder Wrapper ---
class BottleneckT5Autoencoder:
    def __init__(self, model_path: str, device='cpu'):
        self.device = device
        print(f"Loading Autoencoder from {model_path} on {device}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, model_max_length=512)
        # trust_remote_code=True is required for the custom T5 architecture
        self.model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True).to(self.device)
        self.model.eval()

    @torch.no_grad()
    def embed(self, text: str) -> torch.FloatTensor:
        """Encodes text into a latent embedding."""
        inputs = self.tokenizer(text, return_tensors='pt', truncation=True, max_length=512).to(self.device)
        decoder_input_ids = torch.tensor([[self.tokenizer.pad_token_id]], dtype=torch.long).to(self.device)
        outputs = self.model(
            input_ids=inputs['input_ids'],
            attention_mask=inputs['attention_mask'],
            decoder_input_ids=decoder_input_ids,
            encode_only=True,
        )
        return outputs[0]

    @torch.no_grad()
    def generate_from_latent(self, latent: torch.FloatTensor, max_length=512, temperature=0.4) -> str:
        """Decodes a latent embedding back into text."""
        if latent.dim() == 1: latent = latent.unsqueeze(0)
        latent = latent.to(self.device)
        output_sequences = self.model.generate(
            encoder_outputs=None,
            latent_vector=latent,
            max_length=max_length,
            do_sample=True,
            temperature=temperature,
            top_p=0.9,
            num_return_sequences=1,
            pad_token_id=self.tokenizer.eos_token_id
        )
        return self.tokenizer.decode(output_sequences[0], skip_special_tokens=True)

# --- 2. Latent Manipulator Model ---
class LatentManipulator(nn.Module):
    def __init__(self, input_dim=1024, hidden_dim=2048, dropout_rate=0.2):
        super(LatentManipulator, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.LeakyReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_dim, input_dim)
        )

    def forward(self, x):
        return self.net(x)

# --- 3. Main Inference Logic ---
def main():
    parser = argparse.ArgumentParser(description="Latent Manipulator Inference")
    parser.add_argument("--input", type=str, required=True, help="Input text/question")
    parser.add_argument("--checkpoint", type=str, help="Path to trained LatentManipulator checkpoint")
    args = parser.parse_args()

    # Device selection
    if torch.cuda.is_available():
        device = 'cuda'
    elif torch.backends.mps.is_available():
        device = 'mps'
    else:
        device = 'cpu'

    # Load Autoencoder
    # Note: This requires internet access to download the model from HuggingFace
    autoencoder_path = 'thesephist/contra-bottleneck-t5-large-wikipedia'
    try:
        autoencoder = BottleneckT5Autoencoder(autoencoder_path, device)
    except Exception as e:
        print(f"Error loading autoencoder: {e}")
        sys.exit(1)

    # Load Manipulator (Mock if no checkpoint provided)
    manipulator = LatentManipulator().to(device)
    if args.checkpoint:
        try:
            checkpoint = torch.load(args.checkpoint, map_location=device)
            manipulator.load_state_dict(checkpoint['model_state_dict'])
            print(f"Loaded checkpoint from {args.checkpoint}")
        except Exception as e:
            print(f"Error loading checkpoint: {e}")
            sys.exit(1)
    else:
        print("WARNING: No checkpoint provided. Using initialized (random) weights for demonstration.")

    manipulator.eval()

    # Run Inference
    print(f"\nInput: {args.input}")
    
    # 1. Embed
    latent_input = autoencoder.embed(args.input)
    
    # 2. Manipulate
    with torch.no_grad():
        latent_output = manipulator(latent_input)
        
    # 3. Generate
    output_text = autoencoder.generate_from_latent(latent_output)
    
    print(f"Output: {output_text}")

if __name__ == "__main__":
    main()
