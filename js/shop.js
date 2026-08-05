import { db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const productGrid = document.querySelector("#product-grid");
const productStatus = document.querySelector("#product-status");
const productCount = document.querySelector("#product-count");
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const sortSelect = document.querySelector("#sort-select");

let allProducts = [];

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

function createProductCard(product) {
  const stockMessage =
    product.stock <= 10
      ? `Only ${product.stock} left`
      : "In stock";

  const featuredBadge = product.featured
    ? '<span class="featured-badge">Featured</span>'
    : "";

  return `
    <article class="product-card">
      <div class="product-image-wrapper">
        ${featuredBadge}

        <button
          class="wishlist-button"
          type="button"
          data-action="wishlist"
          data-product-id="${escapeHTML(product.id)}"
          aria-label="Add ${escapeHTML(product.name)} to wishlist"
        >
          ♡
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
    `${products.length} product${products.length === 1 ? "" : "s"}`;

  if (products.length === 0) {
    productStatus.textContent =
      "No products match your search or selected category.";

    productStatus.classList.remove("hidden");
    return;
  }

  productStatus.classList.add("hidden");

  productGrid.innerHTML = products
    .map(createProductCard)
    .join("");
}

function filterAndSortProducts() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedSort = sortSelect.value;

  let filteredProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm);

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  filteredProducts = [...filteredProducts];

  switch (selectedSort) {
    case "price-low":
      filteredProducts.sort((a, b) => a.price - b.price);
      break;

    case "price-high":
      filteredProducts.sort((a, b) => b.price - a.price);
      break;

    case "rating-high":
      filteredProducts.sort((a, b) => b.rating - a.rating);
      break;

    case "name-az":
      filteredProducts.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      break;

    default:
      filteredProducts.sort((a, b) => {
        if (a.featured !== b.featured) {
          return Number(b.featured) - Number(a.featured);
        }

        return a.name.localeCompare(b.name);
      });
  }

  renderProducts(filteredProducts);
}

async function loadProducts() {
  productStatus.textContent =
    "Loading products from Firebase...";

  productStatus.classList.remove("hidden");

  try {
    const productsReference = collection(db, "products");
    const querySnapshot = await getDocs(productsReference);

    allProducts = querySnapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data()
    }));

    filterAndSortProducts();
  } catch (error) {
    console.error("Unable to load products:", error);

    productStatus.textContent =
      "We could not load the products. Please refresh the page and try again.";

    productCount.textContent = "Products unavailable";
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

searchInput.addEventListener("input", filterAndSortProducts);
categoryFilter.addEventListener("change", filterAndSortProducts);
sortSelect.addEventListener("change", filterAndSortProducts);

loadProducts();