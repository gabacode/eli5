import logging
import re
from typing import List

import spacy

from config import Config
from libs.audio.audio_player import AudioProcessingError


class TextProcessor:
    """Handles text processing and section splitting."""

    def __init__(self, config: Config):
        self.config = config
        self.nlp = spacy.load('en_core_web_sm')

    def destop_words(self, text: str) -> str:
        """Remove stopwords from a list of tokens."""
        return ' '.join(token.text for token in self.nlp(text) if not token.is_stop)

    def split_into_sections(self, text: str) -> List[str]:
        """Split text into meaningful sections based on paragraphs."""
        if not text:
            logging.warning("Received empty text to split into sections")
            return []

        TARGET_WORDS = 250
        MIN_SECTION_LENGTH = 50

        try:
            text = re.sub(r'\s+', ' ', text).strip()
            doc = self.nlp(text)

            sections = []
            current_section = []
            current_word_count = 0

            for sent in doc.sents:
                sentence_words = len([token for token in sent if not token.is_space])

                if current_word_count + sentence_words > TARGET_WORDS and current_section:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                        logging.debug(f"Created section with {current_word_count} words")
                    current_section = []
                    current_word_count = 0

                current_section.append(sent.text)
                current_word_count += sentence_words

                if current_word_count > TARGET_WORDS * 1.5 and len(current_section) == 1:
                    section_text = ' '.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                        logging.debug(f"Created oversized section with {current_word_count} words")
                    current_section = []
                    current_word_count = 0

            if current_section:
                remaining_text = ' '.join(current_section).strip()
                if remaining_text:
                    if (current_word_count < MIN_SECTION_LENGTH and sections
                            and len(sections[-1].split()) + current_word_count <= TARGET_WORDS * 1.2):
                        sections[-1] = f"{sections[-1]} {remaining_text}"
                        logging.debug(f"Merged short final section with previous section")
                    else:
                        sections.append(remaining_text)
                        logging.debug(f"Created final section with {current_word_count} words")

            if not sections:
                logging.warning("No sections were created from the input text")

            return sections

        except Exception as e:
            logging.error(f"Error in split_into_sections: {e}", exc_info=True)
            raise AudioProcessingError(f"Failed to split text into sections: {e}")

    def extract_sentences(self, text: str) -> List[str]:
        """Extract complete sentences from text."""
        if not text:
            logging.warning("Received empty text to extract sentences")
            return []

        try:
            doc = self.nlp(str(text))
            sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
            logging.debug(f"Extracted {len(sentences)} sentences")
            return sentences
        except Exception as e:
            logging.error(f"Error in extract_sentences: {e}", exc_info=True)
            return []
