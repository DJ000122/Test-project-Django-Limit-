from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase


class _AuthenticatedClient(APIClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.force_authenticate(user=get_user_model()(username="tester", is_active=True))


class AuthenticatedAPITestCase(APITestCase):
    client_class = _AuthenticatedClient
