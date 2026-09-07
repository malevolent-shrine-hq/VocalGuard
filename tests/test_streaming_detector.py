import unittest

import torch

from api.streaming_detector import HOP_SAMPLES, SAMPLE_RATE, StreamingSession, WINDOW_SAMPLES


class _IdentityTransform(torch.nn.Module):
    def forward(self, waveform):
        return waveform


class _ConstantModel(torch.nn.Module):
    def forward(self, waveform):
        return torch.zeros(waveform.shape[0], device=waveform.device)


class _DetectorStub:
    device = torch.device("cpu")
    threshold = 0.0509
    mel_transform = _IdentityTransform()
    model = _ConstantModel()


class StreamingSessionTests(unittest.TestCase):
    def setUp(self):
        self.session = StreamingSession(session_id="test", detector=_DetectorStub())
        self.voice = torch.full((WINDOW_SAMPLES,), 0.1).numpy()

    def test_buffers_until_a_complete_two_second_window(self):
        self.assertIn(self.session.ingest_audio_chunk(self.voice[:SAMPLE_RATE])["state"], {"BUFFERING"})
        result = self.session.ingest_audio_chunk(self.voice[SAMPLE_RATE:])
        self.assertEqual(result["type"], "prediction")
        self.assertEqual(result["window_start"], 0.0)
        self.assertEqual(result["window_end"], 2.0)

    def test_uses_one_second_hop_after_initial_window(self):
        self.session.ingest_audio_chunk(self.voice)
        self.assertIsNone(self.session.ingest_audio_chunk(self.voice[:HOP_SAMPLES - 1]))
        result = self.session.ingest_audio_chunk(self.voice[HOP_SAMPLES - 1:HOP_SAMPLES])
        self.assertEqual(result["type"], "prediction")
        self.assertEqual(result["window_start"], 1.0)
        self.assertEqual(result["window_end"], 3.0)

    def test_silence_is_gated_without_model_prediction(self):
        result = self.session.ingest_audio_chunk(torch.zeros(WINDOW_SAMPLES).numpy())
        self.assertEqual(result["type"], "status")
        self.assertEqual(result["state"], "NO_SPEECH")

    def test_sessions_do_not_share_buffers(self):
        second = StreamingSession(session_id="other", detector=_DetectorStub())
        self.session.ingest_audio_chunk(self.voice)
        self.assertEqual(second.buffer_len, 0)
        self.assertEqual(self.session.buffer_len, WINDOW_SAMPLES)


if __name__ == "__main__":
    unittest.main()
