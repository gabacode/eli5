import logging

from ollama import Client

from libs.audio.audio_player import AudioProcessingError
from config import Config


class OllamaClient:
    """Handles communication with Ollama API."""

    def __init__(self, config: Config):
        self.client = Client(
            host=config.ollama_host,
        )
        self.model = config.ollama_llm

    def get_summary(self, last_section: str, text: str) -> str:
        """Get an engaging summary from Ollama."""
        base_prompt = f"""
        Imagine you're explaining this content to an interested friend who's smart but not an expert in the field. Create an engaging summary that:
        1. Sets the scene and introduces the main ideas like you're telling a story
        2. Explains key concepts using relatable analogies or examples where appropriate
        3. Connects different parts of the content in a natural, flowing way
        4. Highlights the most interesting or surprising elements
        5. Wraps up by emphasizing why this matters or what we learned

        Keep the tone conversational but informative. Aim for about 200-300 words.
        """
        if last_section:
            context_prompt = f"""
            Important: This is a continuation of a longer text. Here's what was covered in the previous section:
            {last_section}
            Please make your summary flow naturally from the previous content, to maintain narrative continuity,
            so you won't need to repeat the previous information, without mentioning it explicitly.
            Text to transform into the next part of the story:
            {text}
            """
            prompt = base_prompt + context_prompt
        else:
            prompt = base_prompt + f"\nText to transform into a story:\n{text}"

        try:
            logging.debug(f"Requesting summary from Ollama for text (len={len(text)})")
            response = self.client.generate(model=self.model, prompt=prompt)
            summary = response["response"] if response else "Summary unavailable."
            logging.debug("Summary received from Ollama")
            return summary
        except Exception as e:
            logging.error(f"Summary generation failed: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to generate summary: {e}")
