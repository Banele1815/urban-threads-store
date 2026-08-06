import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const productGrid =
  document.querySelector("#product-grid");

const productStatus =
  document.querySelector("#product-status");

const productCount =
  document.querySelector("#product-count");

const searchInput =
  document.querySelector("#search-input");

const categoryFilter =
  document.querySelector("#category-filter");

const sortSelect =
  document.querySelector("#sort-select");

let allProducts = [];
let savedWishlistIds = new Set();
let unsubscribeFromWishlist = null;
let toastTimer = null;

const toast = document.createElement("div");

toast.id = "toast";
toast.className = "toast hidden";
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");

document.body.append(toast);

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

function createProductCard(product) {
  const stockMessage =
    product.stock <= 10
      ? `Only ${product.stock} left`
      : "In stock";

  const featuredBadge = product.featured
    ? '<span class="featured-badge">Featured</span>'
    : "";

  const productIsSaved =
    savedWishlistIds.has(product.id);

  const wishlistSymbol =
    productIsSaved ? "♥" : "♡";

  const wishlistLabel =
    productIsSaved
      ? `Remove ${product.name} from wishlist`
      : `Add ${product.name} to wishlist`;

  return `
    <article class="product-card">
      <div class="product-image-wrapper">
        ${featuredBadge}

        <button
          class="wishlist-button ${productIsSaved ? "active" : ""}"
          type="button"
          data-action="wishlist"
          data-product-id="${escapeHTML(product.id)}"
          aria-label="${escapeHTML(wishlistLabel)}"
        >
          ${wishlistSymbol}
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
            data-action="cart"
            data-product-id="${escapeHTML(product.id)}"
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderProducts(products) {
  productGrid.innerHTML = "";

  productCount.textContent =
    `${products.length} product${
      products.length === 1 ? "" : "s"
    }`;

  if (products.length === 0) {
    productStatus.textContent =
      "No products match your search or selected category.";

    productStatus.classList.remove("hidden");
    return;
  }

  productStatus.classList.add("hidden");

  productGrid.innerHTML =
    products.map(createProductCard).join("");
}

function filterAndSortProducts() {
  const searchTerm =
    searchInput.value.trim().toLowerCase();

  const selectedCategory =
    categoryFilter.value;

  const selectedSort =
    sortSelect.value;

  let filteredProducts = allProducts.filter(
    (product) => {
      const matchesSearch =
        product.name
          .toLowerCase()
          .includes(searchTerm) ||
        product.category
          .toLowerCase()
          .includes(searchTerm) ||
        product.description
          .toLowerCase()
          .includes(searchTerm);

      const matchesCategory =
        selectedCategory === "All" ||
        product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    }
  );

  filteredProducts = [...filteredProducts];

  switch (selectedSort) {
    case "price-low":
      filteredProducts.sort(
        (a, b) => a.price - b.price
      );
      break;

    case "price-high":
      filteredProducts.sort(
        (a, b) => b.price - a.price
      );
      break;

    case "rating-high":
      filteredProducts.sort(
        (a, b) => b.rating - a.rating
      );
      break;

    case "name-az":
      filteredProducts.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      break;

    default:
      filteredProducts.sort((a, b) => {
        if (a.featured !== b.featured) {
          return (
            Number(b.featured) -
            Number(a.featured)
          );
        }

        return a.name.localeCompare(b.name);
      });
  }

  renderProducts(filteredProducts);
}

async function addProductToCart(productId, button) {
  const user = auth.currentUser;

  if (!user) {
    window.location.href =
      "./login.html?redirect=shop";

    return;
  }

  const product = allProducts.find(
    (item) => item.id === productId
  );

  if (!product) {
    showToast(
      "This product could not be found.",
      "error"
    );

    return;
  }

  button.disabled = true;
  button.textContent = "Adding...";

  try {
    const cartItemReference = doc(
      db,
      "users",
      user.uid,
      "cart",
      productId
    );

    const cartItemSnapshot =
      await getDoc(cartItemReference);

    const currentQuantity =
      cartItemSnapshot.exists()
        ? Number(
            cartItemSnapshot.data().quantity
          ) || 0
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

    showToast(
      `${product.name} added to your cart.`
    );
  } catch (error) {
    console.error(
      "Could not add product to cart:",
      error
    );

    showToast(
      "The product could not be added. Please try again.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Add to cart";
  }
}

function subscribeToWishlist(user) {
  if (unsubscribeFromWishlist) {
    unsubscribeFromWishlist();
  }

  const wishlistReference = collection(
    db,
    "users",
    user.uid,
    "wishlist"
  );

  unsubscribeFromWishlist = onSnapshot(
    wishlistReference,
    (snapshot) => {
      savedWishlistIds = new Set(
        snapshot.docs.map(
          (wishlistDocument) =>
            wishlistDocument.data().productId
        )
      );

      if (allProducts.length > 0) {
        filterAndSortProducts();
      }
    },
    (error) => {
      console.error(
        "Could not load wishlist status:",
        error
      );
    }
  );
}

async function toggleWishlist(productId, button) {
  const user = auth.currentUser;

  if (!user) {
    window.location.href =
      "./login.html?redirect=shop";

    return;
  }

  const product = allProducts.find(
    (item) => item.id === productId
  );

  if (!product) {
    return;
  }

  const wishlistItemReference = doc(
    db,
    "users",
    user.uid,
    "wishlist",
    productId
  );

  const productIsSaved =
    savedWishlistIds.has(productId);

  button.disabled = true;

  try {
    if (productIsSaved) {
      await deleteDoc(wishlistItemReference);

      showToast(
        `${product.name} removed from your wishlist.`
      );
    } else {
      await setDoc(wishlistItemReference, {
        productId,
        createdAt: serverTimestamp()
      });

      showToast(
        `${product.name} saved to your wishlist.`
      );
    }
  } catch (error) {
    console.error(
      "Could not update wishlist:",
      error
    );

    showToast(
      "Your wishlist could not be updated.",
      "error"
    );

    button.disabled = false;
  }
}

async function loadProducts() {
  productStatus.textContent =
    "Loading products from Firebase...";

  productStatus.classList.remove("hidden");

  try {
    const productsReference = collection(
      db,
      "products"
    );

    const querySnapshot =
      await getDocs(productsReference);

    allProducts = querySnapshot.docs.map(
      (documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data()
      })
    );

    filterAndSortProducts();
  } catch (error) {
    console.error(
      "Unable to load products:",
      error
    );

    productStatus.textContent =
      "We could not load the products. Please refresh the page and try again.";

    productCount.textContent =
      "Products unavailable";

    productStatus.classList.remove("hidden");
  }
}

productGrid.addEventListener(
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

searchInput.addEventListener(
  "input",
  filterAndSortProducts
);

categoryFilter.addEventListener(
  "change",
  filterAndSortProducts
);

sortSelect.addEventListener(
  "change",
  filterAndSortProducts
);

productGrid.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      "[data-action]"
    );

    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const productId = button.dataset.productId;

    if (action === "cart") {
      await addProductToCart(
        productId,
        button
      );
    }

    if (action === "wishlist") {
      await toggleWishlist(
        productId,
        button
      );
    }
  }
);

onAuthStateChanged(auth, (user) => {
  if (user) {
    subscribeToWishlist(user);
  } else {
    if (unsubscribeFromWishlist) {
      unsubscribeFromWishlist();
      unsubscribeFromWishlist = null;
    }

    savedWishlistIds.clear();

    if (allProducts.length > 0) {
      filterAndSortProducts();
    }
  }
});

const categoryFromURL = new URLSearchParams(
  window.location.search
).get("category");

if (categoryFromURL) {
  const matchingOption = Array.from(
    categoryFilter.options
  ).find(
    (option) =>
      option.value.toLowerCase() ===
      categoryFromURL.toLowerCase()
  );

  if (matchingOption) {
    categoryFilter.value = matchingOption.value;
  }
}

loadProducts();