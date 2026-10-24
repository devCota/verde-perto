from typing import Literal
from decimal import Decimal
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

Category = Literal[
    "fruits", "vegetables", "greens", "herbs", "plants", "seeds", "other"
]
Offer = Literal["donation", "exchange", "sale"]
Status = Literal["available", "reserved", "unavailable", "completed"]


class Input(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True, extra="forbid", allow_inf_nan=False
    )


class Register(Input):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    city: str = Field(min_length=2, max_length=80)
    neighborhood: str = Field(min_length=2, max_length=80)


class Login(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class Profile(Input):
    name: str = Field(min_length=2, max_length=80)
    bio: str = Field(max_length=500, default="")
    city: str = Field(min_length=2, max_length=80)
    neighborhood: str = Field(min_length=2, max_length=80)


class PasswordChange(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ListingInput(Input):
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=10, max_length=3000)
    category: Category
    quantity: float = Field(ge=0, le=1000000)
    unit: Literal["unidades", "kg", "g", "maços", "mudas", "pacotes", "litros"]
    offer_type: Offer
    price: Decimal | None = Field(default=None, ge=0, le=1000000, decimal_places=2)
    exchange_for: str = Field(default="", max_length=200)
    image_url: str | None = Field(default=None, max_length=300)
    city: str = Field(min_length=2, max_length=80)
    neighborhood: str = Field(min_length=2, max_length=80)
    public_latitude: float = Field(ge=-90, le=90)
    public_longitude: float = Field(ge=-180, le=180)
    status: Status = "available"

    @field_validator("public_latitude", "public_longitude")
    @classmethod
    def approximate(cls, value):
        # Única localização persistida: célula de aproximadamente 1 km.
        return round(value, 2)

    @field_validator("image_url")
    @classmethod
    def local_image(cls, value):
        import re

        if value and not re.fullmatch(
            r"/api/media/[a-f0-9]{32}\.jpg|/assets/[a-z0-9-]+\.(?:jpg|svg)", value
        ):
            raise ValueError("Envie uma imagem pelo formulário.")
        return value

    @model_validator(mode="after")
    def offer_fields(self):
        if self.offer_type == "sale" and (self.price is None or self.price <= 0):
            raise ValueError("Informe um preço maior que zero para venda.")
        if self.offer_type != "sale":
            self.price = None
        if self.quantity == 0:
            self.status = "completed"
        return self


class Availability(Input):
    quantity: float = Field(ge=0, le=1000000)
    status: Status


class ConversationInput(Input):
    listing_id: int = Field(gt=0)


class MessageInput(Input):
    content: str = Field(min_length=1, max_length=2000)
