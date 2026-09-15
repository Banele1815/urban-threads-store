import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const headingElement = document.querySelector("#order-status-heading");
const messageElement = document.querySelector("#order-status-message");

const orderId = new URLSearchParams(window.location.search).get("order");

function renderStatus(status) {
  if (status === "paid") {
    headingElement.textContent = "Payment confirmed 🎉";

    messageElement.textContent =
      "Thank you for shopping with Urban Threads. Your sandbox " +
      "payment was confirmed by PayFast and your cart has been " +
      "cleared.";

    return;
  }

  if (status === "pending") {
    headingElement.textContent = "Confirming your payment...";

    messageElement.textContent =
      "PayFast hasn't confirmed this payment yet. This page will " +
      "update automatically once it does — feel free to leave it " +
      "open for a moment.";

    return;
  }

  headingElement.textContent = "Payment not completed";

  messageElement.textContent =
    `PayFast reported this order's status as "${status}". If you ` +
    "believe this is a mistake, please try checking out again.";
}

if (!orderId) {
  headingElement.textContent = "Order not found";

  messageElement.textContent =
    "We couldn't find an order reference in the URL. If you just " +
    "paid, check your account for the order instead.";
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      headingElement.textContent = "Please log in";

      messageElement.textContent =
        "Log in to your Urban Threads account to view this order's " +
        "status.";

      return;
    }

    onSnapshot(
      doc(db, "orders", orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          headingElement.textContent = "Order not found";

          messageElement.textContent =
            "We couldn't find this order on your account.";

          return;
        }

        renderStatus(snapshot.data().status);
      },
      (error) => {
        console.error("Could not load order status:", error);

        headingElement.textContent = "Something went wrong";

        messageElement.textContent =
          "We couldn't load your order status. Please refresh the " +
          "page.";
      }
    );
  });
}