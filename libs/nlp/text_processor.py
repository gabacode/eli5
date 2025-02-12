import re
from dataclasses import dataclass
from typing import List

import spacy

from config import Config
from libs.audio.audio_player import AudioProcessingError
from libs.utils.logger import Logger


@dataclass
class SectionInfo:
    section: str
    subjects: List[str]


class TextProcessor:
    """Handles text processing and section splitting."""

    def __init__(self, config: Config):
        self.config = config
        self.logger = Logger()
        self.nlp = spacy.load('en_core_web_sm')

    def destop_words(self, text: str) -> str:
        """Remove stopwords from a list of tokens."""
        return ' '.join(token.text for token in self.nlp(text) if not token.is_stop)

    def split_into_sections(self, text: str, target_words: int = 250, min_section_length: int = 50) -> List[
        SectionInfo]:
        """
        Split text into meaningful sections based on paragraphs.
        @param text: The input text to split.
        @param target_words: The target number of words per section.
        @param min_section_length: The minimum number of words for a section.
        """
        if not text:
            self.logger and self.logger.warning("Empty text received")
            return []

        try:
            doc = self.nlp(re.sub(r'\s+', ' ', text).strip())
            sections = []
            current = []
            subjects = []
            word_count = 0

            for sent in doc.sents:
                sent_words = len([t for t in sent if not t.is_space])
                subjects.extend(tok.text for tok in sent if tok.dep_ == "nsubj")

                # Create new section if we're over target (but not for single sentences)
                if word_count + sent_words > target_words and current:
                    sections.append(SectionInfo(' '.join(current).strip(), subjects))
                    current, subjects, word_count = [], [], 0

                current.append(sent.text)
                word_count += sent_words

                # Handle very long single sentences
                if word_count > target_words * 1.5 and len(current) == 1:
                    sections.append(SectionInfo(' '.join(current).strip(), subjects))
                    current, subjects, word_count = [], [], 0

            # Handle remaining text
            if current:
                remaining = ' '.join(current).strip()
                # Merge short final section if possible
                if (word_count < min_section_length and sections and
                        len(sections[-1].section.split()) + word_count <= target_words * 1.2):
                    sections[-1].section += " " + remaining
                    sections[-1].subjects.extend(subjects)
                else:
                    sections.append(SectionInfo(remaining, subjects))

            return sections

        except Exception as e:
            self.logger and self.logger.error(f"Error splitting text: {e}")
            raise AudioProcessingError(f"Failed to split text: {e}")

    def extract_sentences(self, text: str) -> List[str]:
        """Extract complete sentences from text."""
        if not text:
            self.logger.warning("Received empty text to extract sentences")
            return []

        try:
            doc = self.nlp(str(text))
            sentences = [sent.text.strip() for sent in doc.sents if sent.text.strip()]
            self.logger.debug(f"Extracted {len(sentences)} sentences")
            return sentences
        except Exception as e:
            self.logger.error(f"Error in extract_sentences: {e}")
            return []
