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
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const wishlistStatus =
  document.querySelector("#wishlist-status");

const wishlistContent =
  document.querySelector("#wishlist-content");

const wishlistGrid =
  document.querySelector("#wishlist-grid");

const wishlistCount =
  document.querySelector("#wishlist-count");

const emptyWishlist =
  document.querySelector("#empty-wishlist");

const toast =
  document.querySelector("#toast");

let currentUser = null;
let savedProducts = [];
let unsubscribeFromWishlist = null;
let toastTimer = null;

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

function createWishlistCard(product) {
  const stockMessage =
    product.stock <= 10
      ? `Only ${product.stock} left`
      : "In stock";

  return `
    <article class="product-card">
      <div class="product-image-wrapper">
        <button
          class="wishlist-button active"
          type="button"
          data-wishlist-action="remove"
          data-product-id="${escapeHTML(product.id)}"
          aria-label="Remove ${escapeHTML(product.name)} from wishlist"
        >
          ♥
        </button>

        <img
          class="product-image"
          src="${escapeHTML(product.imageURL)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >
      </div>

      <div class="product-information">
        <div class="product-meta">
          <span class="product-category">
            ${escapeHTML(product.category)}
          </span>

          <span class="product-rating">
            ★ ${escapeHTML(product.rating)}
          </span>
        </div>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="product-description">
          ${escapeHTML(product.description)}
        </p>

        <p class="product-stock">
          ${escapeHTML(stockMessage)}
        </p>

        <div class="product-footer">
          <p class="product-price">
            ${currencyFormatter.format(product.price)}
          </p>

          <button
            class="add-to-cart-button"
            type="button"
            data-wishlist-action="cart"
            data-product-id="${escapeHTML(product.id)}"
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  `;
}

async function getProduct(productId) {
  const productReference = doc(
    db,
    "products",
    productId
  );

  const productSnapshot =
    await getDoc(productReference);

  if (!productSnapshot.exists()) {
    return null;
  }

  return {
    id: productSnapshot.id,
    ...productSnapshot.data()
  };
}

async function displayWishlist(wishlistDocuments) {
  const products = await Promise.all(
    wishlistDocuments.map((wishlistDocument) => {
      return getProduct(
        wishlistDocument.data().productId
      );
    })
  );

  savedProducts = products.filter(Boolean);

  wishlistGrid.innerHTML =
    savedProducts.map(createWishlistCard).join("");

  const wishlistIsEmpty =
    savedProducts.length === 0;

  wishlistGrid.classList.toggle(
    "hidden",
    wishlistIsEmpty
  );

  emptyWishlist.classList.toggle(
    "hidden",
    !wishlistIsEmpty
  );

  wishlistCount.textContent =
    `${savedProducts.length} product${
      savedProducts.length === 1 ? "" : "s"
    }`;

  wishlistStatus.classList.add("hidden");
  wishlistContent.classList.remove("hidden");
}

function subscribeToWishlist(user) {
  wishlistStatus.textContent =
    "Loading your wishlist...";

  const wishlistReference = collection(
    db,
    "users",
    user.uid,
    "wishlist"
  );

  unsubscribeFromWishlist = onSnapshot(
    wishlistReference,
    async (snapshot) => {
      try {
        await displayWishlist(snapshot.docs);
      } catch (error) {
        console.error(
          "Could not display the wishlist:",
          error
        );

        wishlistStatus.textContent =
          "Your wishlist could not be displayed.";
      }
    },
    (error) => {
      console.error(
        "Could not load the wishlist:",
        error
      );

      wishlistStatus.textContent =
        "Your wishlist could not be loaded.";
    }
  );
}

async function removeFromWishlist(productId) {
  const wishlistItemReference = doc(
    db,
    "users",
    currentUser.uid,
    "wishlist",
    productId
  );

  await deleteDoc(wishlistItemReference);

  showToast("Product removed from your wishlist.");
}

async function addToCart(productId) {
  const product = savedProducts.find(
    (item) => item.id === productId
  );

  if (!product) {
    return;
  }

  const cartItemReference = doc(
    db,
    "users",
    currentUser.uid,
    "cart",
    productId
  );

  const cartItemSnapshot =
    await getDoc(cartItemReference);

  const currentQuantity =
    cartItemSnapshot.exists()
      ? Number(cartItemSnapshot.data().quantity) || 0
      : 0;

  const maximumQuantity = Math.min(
    10,
    Number(product.stock)
  );

  if (currentQuantity >= maximumQuantity) {
    showToast(
      `You can only add ${maximumQuantity} of this product.`,
      "error"
    );

    return;
  }

  await setDoc(cartItemReference, {
    productId,
    quantity: currentQuantity + 1,
    updatedAt: serverTimestamp()
  });

  showToast(`${product.name} added to your cart.`);
}

wishlistGrid.addEventListener(
  "error",
  (event) => {
    const image = event.target;

    if (
      image.matches(".product-image") &&
      image.dataset.fallbackApplied !== "true"
    ) {
      image.dataset.fallbackApplied = "true";

      image.src =
        "https://placehold.co/600x700/171717/FFFFFF?text=Urban+Threads";
    }
  },
  true
);

wishlistGrid.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      "[data-wishlist-action]"
    );

    if (!button || !currentUser) {
      return;
    }

    const action =
      button.dataset.wishlistAction;

    const productId =
      button.dataset.productId;

    button.disabled = true;

    try {
      if (action === "remove") {
        await removeFromWishlist(productId);
      }

      if (action === "cart") {
        await addToCart(productId);
        button.disabled = false;
      }
    } catch (error) {
      console.error(
        "Wishlist action failed:",
        error
      );

      showToast(
        "The action could not be completed. Please try again.",
        "error"
      );

      button.disabled = false;
    }
  }
);

onAuthStateChanged(auth, (user) => {
  if (unsubscribeFromWishlist) {
    unsubscribeFromWishlist();
    unsubscribeFromWishlist = null;
  }

  if (!user) {
    currentUser = null;

    wishlistContent.classList.add("hidden");
    wishlistStatus.classList.remove("hidden");

    wishlistStatus.textContent =
      "You must log in to access your wishlist. Redirecting...";

    window.setTimeout(() => {
      window.location.href =
        "./login.html?redirect=wishlist";
    }, 1000);

    return;
  }

  currentUser = user;
  subscribeToWishlist(user);
});