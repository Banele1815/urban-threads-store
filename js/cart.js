import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const cartStatus = document.querySelector("#cart-status");
const cartContent = document.querySelector("#cart-content");
const cartItemsContainer = document.querySelector("#cart-items");
const emptyCart = document.querySelector("#empty-cart");
const cartItemCount = document.querySelector("#cart-item-count");
const cartSubtotal = document.querySelector("#cart-subtotal");
const cartTotal = document.querySelector("#cart-total");
const checkoutButton = document.querySelector("#checkout-button");
const clearCartButton = document.querySelector("#clear-cart-button");
const toast = document.querySelector("#toast");
const checkoutModal = document.querySelector("#checkout-modal");
const modalCloseButton = document.querySelector("#modal-close-button");
const finishCheckoutButton =
  document.querySelector("#finish-checkout-button");

let currentUser = null;
let currentCartItems = [];
let unsubscribeFromCart = null;
let toastTimer = null;

const productCache = new Map();

const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR"
});

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, type = "success") {
  window.clearTimeout(toastTimer);

  toast.textContent = message;
  toast.className = `toast ${type}`;

  toastTimer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

async function getProduct(productId) {
  if (productCache.has(productId)) {
    return productCache.get(productId);
  }

  const productReference = doc(db, "products", productId);
  const productSnapshot = await getDoc(productReference);

  if (!productSnapshot.exists()) {
    return null;
  }

  const product = {
    id: productSnapshot.id,
    ...productSnapshot.data()
  };

  productCache.set(productId, product);

  return product;
}

function createCartItem({ product, quantity }) {
  const itemTotal = product.price * quantity;

  return `
    <article class="cart-item" data-product-id="${escapeHTML(product.id)}">
      <div class="cart-item-image-wrapper">
        <img
          class="cart-item-image"
          src="${escapeHTML(product.imageURL)}"
          alt="${escapeHTML(product.name)}"
        >
      </div>

      <div class="cart-item-information">
        <p class="product-category">
          ${escapeHTML(product.category)}
        </p>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="cart-unit-price">
          ${currencyFormatter.format(product.price)} each
        </p>

        <p class="cart-stock">
          ${escapeHTML(product.stock)} currently in stock
        </p>

        <div class="cart-item-actions">
          <div
            class="quantity-control"
            aria-label="Change quantity for ${escapeHTML(product.name)}"
          >
            <button
              type="button"
              data-cart-action="decrease"
              data-product-id="${escapeHTML(product.id)}"
              aria-label="Decrease quantity"
              ${quantity <= 1 ? "disabled" : ""}
            >
              −
            </button>

            <span aria-label="Quantity">
              ${escapeHTML(quantity)}
            </span>

            <button
              type="button"
              data-cart-action="increase"
              data-product-id="${escapeHTML(product.id)}"
              aria-label="Increase quantity"
              ${quantity >= 10 ? "disabled" : ""}
            >
              +
            </button>
          </div>

          <button
            class="remove-item-button"
            type="button"
            data-cart-action="remove"
            data-product-id="${escapeHTML(product.id)}"
          >
            Remove
          </button>
        </div>
      </div>

      <p class="cart-line-total">
        ${currencyFormatter.format(itemTotal)}
      </p>
    </article>
  `;
}

function updateSummary(items) {
  const totalQuantity = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = items.reduce(
    (total, item) =>
      total + item.product.price * item.quantity,
    0
  );

  cartItemCount.textContent =
    `${totalQuantity} item${totalQuantity === 1 ? "" : "s"}`;

  cartSubtotal.textContent =
    currencyFormatter.format(subtotal);

  cartTotal.textContent =
    currencyFormatter.format(subtotal);

  const cartIsEmpty = items.length === 0;

  checkoutButton.disabled = cartIsEmpty;
  clearCartButton.disabled = cartIsEmpty;
}

async function displayCart(cartDocuments) {
  const cartDetails = await Promise.all(
    cartDocuments.map(async (cartDocument) => {
      const cartData = cartDocument.data();
      const product = await getProduct(cartData.productId);

      if (!product) {
        return null;
      }

      return {
        documentId: cartDocument.id,
        product,
        quantity: Number(cartData.quantity) || 1
      };
    })
  );

  currentCartItems = cartDetails.filter(Boolean);

  cartItemsContainer.innerHTML = currentCartItems
    .map(createCartItem)
    .join("");

  const cartIsEmpty = currentCartItems.length === 0;

  emptyCart.classList.toggle("hidden", !cartIsEmpty);
  cartItemsContainer.classList.toggle("hidden", cartIsEmpty);

  updateSummary(currentCartItems);

  cartStatus.classList.add("hidden");
  cartContent.classList.remove("hidden");
}

function subscribeToCart(user) {
  cartStatus.textContent = "Loading your cart...";
  cartStatus.classList.remove("hidden");
  cartContent.classList.add("hidden");

  const cartReference = collection(
    db,
    "users",
    user.uid,
    "cart"
  );

  unsubscribeFromCart = onSnapshot(
    cartReference,
    async (snapshot) => {
      try {
        await displayCart(snapshot.docs);
      } catch (error) {
        console.error("Could not display the cart:", error);

        cartStatus.textContent =
          "Your cart could not be displayed. Please refresh the page.";
      }
    },
    (error) => {
      console.error("Could not load the cart:", error);

      cartStatus.textContent =
        "Your cart could not be loaded. Please try again.";
    }
  );
}

async function changeQuantity(productId, change) {
  const cartItem = currentCartItems.find(
    (item) => item.product.id === productId
  );

  if (!cartItem || !currentUser) {
    return;
  }

  const newQuantity = cartItem.quantity + change;

  if (newQuantity < 1 || newQuantity > 10) {
    showToast(
      "Cart quantities must be between 1 and 10.",
      "error"
    );

    return;
  }

  const cartItemReference = doc(
    db,
    "users",
    currentUser.uid,
    "cart",
    productId
  );

  await updateDoc(cartItemReference, {
    quantity: newQuantity,
    updatedAt: serverTimestamp()
  });
}

async function removeItem(productId) {
  if (!currentUser) {
    return;
  }

  const cartItemReference = doc(
    db,
    "users",
    currentUser.uid,
    "cart",
    productId
  );

  await deleteDoc(cartItemReference);

  showToast("Item removed from your cart.");
}

async function clearCart(askForConfirmation = true) {
  if (!currentUser || currentCartItems.length === 0) {
    return false;
  }

  if (
    askForConfirmation &&
    !window.confirm("Remove every item from your cart?")
  ) {
    return false;
  }

  const batch = writeBatch(db);

  currentCartItems.forEach((item) => {
    const itemReference = doc(
      db,
      "users",
      currentUser.uid,
      "cart",
      item.product.id
    );

    batch.delete(itemReference);
  });

  await batch.commit();

  if (askForConfirmation) {
    showToast("Your cart has been cleared.");
  }

  return true;
}

cartItemsContainer.addEventListener(
  "error",
  (event) => {
    const image = event.target;

    if (
      image.matches(".cart-item-image") &&
      image.dataset.fallbackApplied !== "true"
    ) {
      image.dataset.fallbackApplied = "true";

      image.src =
        "https://placehold.co/400x500/171717/FFFFFF?text=Urban+Threads";
    }
  },
  true
);

cartItemsContainer.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      "[data-cart-action]"
    );

    if (!button) {
      return;
    }

    const action = button.dataset.cartAction;
    const productId = button.dataset.productId;

    button.disabled = true;

    try {
      if (action === "increase") {
        await changeQuantity(productId, 1);
      }

      if (action === "decrease") {
        await changeQuantity(productId, -1);
      }

      if (action === "remove") {
        await removeItem(productId);
      }
    } catch (error) {
      console.error("Cart update failed:", error);

      showToast(
        "The cart could not be updated. Please try again.",
        "error"
      );

      button.disabled = false;
    }
  }
);

clearCartButton.addEventListener("click", async () => {
  clearCartButton.disabled = true;

  try {
    const cartWasCleared = await clearCart(true);

    if (!cartWasCleared) {
      clearCartButton.disabled = false;
    }
  } catch (error) {
    console.error("Could not clear the cart:", error);

    showToast(
      "The cart could not be cleared. Please try again.",
      "error"
    );

    clearCartButton.disabled = false;
  }
});

checkoutButton.addEventListener("click", async () => {
  checkoutButton.disabled = true;

  try {
    const orderWasCompleted = await clearCart(false);

    if (!orderWasCompleted) {
      checkoutButton.disabled = false;
      return;
    }

    checkoutModal.classList.remove("hidden");
    modalCloseButton.focus();
  } catch (error) {
    console.error("Checkout failed:", error);

    showToast(
      "Checkout could not be completed. Please try again.",
      "error"
    );

    checkoutButton.disabled = false;
  }
});

function closeCheckoutModal() {
  checkoutModal.classList.add("hidden");
}

modalCloseButton.addEventListener(
  "click",
  closeCheckoutModal
);

checkoutModal
  .querySelector(".checkout-modal-backdrop")
  .addEventListener("click", closeCheckoutModal);

finishCheckoutButton.addEventListener("click", () => {
  window.location.href = "./shop.html";
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !checkoutModal.classList.contains("hidden")
  ) {
    closeCheckoutModal();
  }
});

onAuthStateChanged(auth, (user) => {
  if (unsubscribeFromCart) {
    unsubscribeFromCart();
    unsubscribeFromCart = null;
  }

  if (!user) {
    currentUser = null;

    cartContent.classList.add("hidden");
    cartStatus.classList.remove("hidden");

    cartStatus.textContent =
      "You must log in before accessing your cart. Redirecting...";

    window.setTimeout(() => {
      window.location.href =
        "./login.html?redirect=cart";
    }, 1000);

    return;
  }

  currentUser = user;
  subscribeToCart(user);
});