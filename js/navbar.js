import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const mobileMenuButton =
  document.querySelector("#mobile-menu-button");

const navLinks =
  document.querySelector("#nav-links");

const userEmail =
  document.querySelector("#user-email");

const loginLink =
  document.querySelector("#login-link");

const logoutButton =
  document.querySelector("#logout-button");

const cartCount =
  document.querySelector("#cart-count");

let unsubscribeFromCart = null;

function closeMobileMenu() {
  navLinks?.classList.remove("open");

  mobileMenuButton?.setAttribute(
    "aria-expanded",
    "false"
  );

  if (mobileMenuButton) {
    mobileMenuButton.textContent = "☰";
  }
}

function updateCartCount(user) {
  if (unsubscribeFromCart) {
    unsubscribeFromCart();
    unsubscribeFromCart = null;
  }

  if (!user || !cartCount) {
    if (cartCount) {
      cartCount.textContent = "0";
    }

    return;
  }

  const cartReference = collection(
    db,
    "users",
    user.uid,
    "cart"
  );

  unsubscribeFromCart = onSnapshot(
    cartReference,
    (snapshot) => {
      const totalQuantity = snapshot.docs.reduce(
        (total, documentSnapshot) => {
          const quantity =
            Number(documentSnapshot.data().quantity) || 0;

          return total + quantity;
        },
        0
      );

      cartCount.textContent = totalQuantity;
    },
    (error) => {
      console.error(
        "Unable to update cart count:",
        error
      );

      cartCount.textContent = "0";
    }
  );
}

mobileMenuButton?.addEventListener("click", () => {
  const menuIsOpen =
    navLinks.classList.toggle("open");

  mobileMenuButton.setAttribute(
    "aria-expanded",
    String(menuIsOpen)
  );

  mobileMenuButton.textContent =
    menuIsOpen ? "✕" : "☰";
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMobileMenu);
});

document.addEventListener("click", (event) => {
  const clickedInsideNavbar =
    event.target.closest(".navbar");

  if (!clickedInsideNavbar) {
    closeMobileMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (userEmail) {
      userEmail.textContent =
        user.displayName || user.email;
    }

    loginLink?.classList.add("hidden");
    logoutButton?.classList.remove("hidden");
  } else {
    if (userEmail) {
      userEmail.textContent = "";
    }

    loginLink?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");
  }

  updateCartCount(user);
});

logoutButton?.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Logging out...";

  try {
    await signOut(auth);
    window.location.href = "./index.html";
  } catch (error) {
    console.error("Unable to log out:", error);

    logoutButton.disabled = false;
    logoutButton.textContent = "Logout";
  }
});