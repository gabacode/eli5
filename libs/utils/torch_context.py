import torch


class torch_load_context:
    def __init__(self, weights_only: bool):
        self.weights_only = weights_only
        self.original_load = None

    def __enter__(self):
        self.original_load = torch.load
        torch.load = lambda *args, **kwargs: self.original_load(
            *args, **kwargs, weights_only=self.weights_only
        )

    def __exit__(self, exc_type, exc_val, exc_tb):
        torch.load = self.original_load
