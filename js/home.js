import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  limit,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const featuredStatus =
  document.querySelector("#featured-status");

const featuredProductGrid =
  document.querySelector("#featured-product-grid");

const heroImage =
  document.querySelector("#hero-image");

const newsletterForm =
  document.querySelector("#newsletter-form");

const newsletterEmail =
  document.querySelector("#newsletter-email");

const newsletterMessage =
  document.querySelector("#newsletter-message");

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

function createFeaturedCard(product) {
  const stockMessage =
    product.stock <= 10
      ? `Only ${product.stock} left`
      : "In stock";

  return `
    <article class="product-card">
      <div class="product-image-wrapper">
        <span class="featured-badge">
          Featured
        </span>

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

          <a
            href="./shop.html"
            class="add-to-cart-button"
          >
            View product
          </a>
        </div>
      </div>
    </article>
  `;
}

async function loadFeaturedProducts() {
  featuredStatus.textContent =
    "Loading featured products from Firebase...";

  try {
    const featuredProductsQuery = query(
      collection(db, "products"),
      where("featured", "==", true),
      limit(4)
    );

    const querySnapshot =
      await getDocs(featuredProductsQuery);

    const featuredProducts =
      querySnapshot.docs.map(
        (documentSnapshot) => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data()
        })
      );

    if (featuredProducts.length === 0) {
      featuredStatus.textContent =
        "No featured products are available.";

      return;
    }

    featuredProductGrid.innerHTML =
      featuredProducts
        .map(createFeaturedCard)
        .join("");

    featuredStatus.classList.add("hidden");
  } catch (error) {
    console.error(
      "Could not load featured products:",
      error
    );

    featuredStatus.textContent =
      "Featured products could not be loaded.";
  }
}

featuredProductGrid.addEventListener(
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

heroImage.addEventListener("error", () => {
  if (
    heroImage.dataset.fallbackApplied === "true"
  ) {
    return;
  }

  heroImage.dataset.fallbackApplied = "true";

  heroImage.src =
    "https://placehold.co/800x1000/171717/FFFFFF?text=Urban+Threads";
});

newsletterForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    const email =
      newsletterEmail.value.trim().toLowerCase();

    if (!email || !newsletterEmail.validity.valid) {
      newsletterMessage.textContent =
        "Please enter a valid email address.";

      newsletterMessage.className =
        "newsletter-message error";

      return;
    }

    localStorage.setItem(
      "urbanThreadsNewsletterEmail",
      email
    );

    newsletterForm.reset();

    newsletterMessage.textContent =
      "You are on the list! Watch this space for the next drop.";

    newsletterMessage.className =
      "newsletter-message success";
  }
);

loadFeaturedProducts();