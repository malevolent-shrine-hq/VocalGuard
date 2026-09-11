import unittest
import jwt
import numpy as np
from fastapi.testclient import TestClient

from api.auth import AuthenticatedUser, get_current_user
from api.index import app
from api.speaker_biometrics import biometrics_engine


class ClerkAuthTests(unittest.TestCase):
    def setUp(self):
        biometrics_engine._load_vault()
        self.client = TestClient(app)

    def tearDown(self):
        # Clean up any test profiles
        for sid in list(biometrics_engine.enrolled_speakers.keys()):
            if sid.startswith("user_"):
                del biometrics_engine.enrolled_speakers[sid]
        biometrics_engine._save_vault()
        biometrics_engine._load_vault()

    def test_unauthenticated_session_falls_back_to_guest(self):
        session = get_current_user(authorization=None)
        self.assertFalse(session.is_authenticated)
        self.assertIn("guest", session.id)
        self.assertIn("Guest", session.name)

    def test_dev_token_generates_authenticated_session(self):
        token = jwt.encode(
            {"sub": "user_test_clerk_123", "email": "test@vocalguard.internal", "name": "Alice Tester"},
            "test_secret_32_bytes_long_enough_for_hs256!",
            algorithm="HS256"
        )
        session = get_current_user(authorization=f"Bearer {token}")
        self.assertTrue(session.is_authenticated)
        self.assertEqual(session.id, "user_test_clerk_123")
        self.assertEqual(session.email, "test@vocalguard.internal")
        self.assertEqual(session.name, "Alice Tester")

    def test_api_auth_me_endpoint_guest_and_authenticated(self):
        # 1. Guest request
        res_guest = self.client.get("/api/auth/me")
        self.assertEqual(res_guest.status_code, 200)
        data_guest = res_guest.json()
        self.assertFalse(data_guest["authenticated"])
        self.assertIsNone(data_guest["user"])

        # 2. Authenticated request with token
        token = jwt.encode(
            {"sub": "user_bob_456", "email": "bob@security.corp", "name": "Bob Security"},
            "test_secret_32_bytes_long_enough_for_hs256!",
            algorithm="HS256"
        )
        res_auth = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_auth.status_code, 200)
        data_auth = res_auth.json()
        self.assertTrue(data_auth["authenticated"])
        self.assertEqual(data_auth["user"]["id"], "user_bob_456")
        self.assertEqual(data_auth["user"]["email"], "bob@security.corp")
        self.assertFalse(data_auth["has_enrolled_voiceprint"])

    def test_personal_profile_enrollment_and_isolation(self):
        # Generate dummy 16kHz audio (1 second)
        sr = 16000
        t = np.linspace(0, 1.0, sr, endpoint=False)
        audio = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

        # User A enrolls their own profile
        user_a_id = "user_clerk_alice"
        user_a_email = "alice@example.com"
        profile_a = biometrics_engine.enroll_speaker(
            speaker_id=f"user_{user_a_id}",
            name="Alice Operative",
            audio=audio,
            role="Treasury Director",
            authorized_limit="₹ 10,00,00,000",
            user_id=user_a_id,
            user_email=user_a_email,
            is_own_profile=True
        )

        self.assertEqual(profile_a["speaker_id"], f"user_{user_a_id}")
        self.assertTrue(profile_a["is_own_profile"])
        self.assertEqual(profile_a["user_id"], user_a_id)

        # Check retrieval via get_user_profile
        retrieved = biometrics_engine.get_user_profile(user_a_id)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Alice Operative")

        # Check profile listing for User A (Alice should own it)
        profiles_for_alice = biometrics_engine.list_profiles(current_user_id=user_a_id)
        alice_p = next(p for p in profiles_for_alice if p["speaker_id"] == profile_a["speaker_id"])
        self.assertTrue(alice_p["is_owner"])
        self.assertTrue(alice_p["is_own_profile"])

        # Check profile listing for User B (Bob should NOT own Alice's profile)
        user_b_id = "user_clerk_bob"
        profiles_for_bob = biometrics_engine.list_profiles(current_user_id=user_b_id)
        bob_view_of_alice = next(p for p in profiles_for_bob if p["speaker_id"] == profile_a["speaker_id"])
        self.assertFalse(bob_view_of_alice["is_owner"])
        self.assertFalse(bob_view_of_alice["is_own_profile"])

        # Bob attempts to delete Alice's profile -> raises PermissionError
        with self.assertRaises(PermissionError):
            biometrics_engine.delete_profile(profile_a["speaker_id"], current_user_id=user_b_id)

        # Alice deletes her own profile -> succeeds
        deleted = biometrics_engine.delete_profile(profile_a["speaker_id"], current_user_id=user_a_id)
        self.assertTrue(deleted)
        self.assertIsNone(biometrics_engine.get_user_profile(user_a_id))

    def test_api_cannot_delete_system_profile(self):
        # Identify a system profile
        system_profiles = [sid for sid in biometrics_engine.enrolled_speakers.keys() if sid.startswith("cxo_")]
        self.assertTrue(len(system_profiles) > 0)
        target_sys_id = system_profiles[0]

        token = jwt.encode(
            {"sub": "user_hacker", "name": "Attacker"},
            "test_secret_32_bytes_long_enough_for_hs256!",
            algorithm="HS256"
        )
        res = self.client.delete(
            f"/api/biometrics/profiles/{target_sys_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("System profile", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
