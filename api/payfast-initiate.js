import { adminAuth, adminDb } from "../lib/firebase-admin.js";
import { buildSignature, PAYFAST_URLS, payfastMode } from "../lib/payfast.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // The client sends its Firebase ID token so we know which user's
  // cart to charge for — never trust a user id sent from the browser.
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    res.status(401).json({ error: "Missing authentication token." });
    return;
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error("payfast-initiate: token verification failed:", error);
    res.status(401).json({ error: "Invalid authentication token." });
    return;
  }

  const userId = decodedToken.uid;

  const cartSnapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("cart")
    .get();

  if (cartSnapshot.empty) {
    res.status(400).json({ error: "Your cart is empty." });
    return;
  }

  // Re-price the cart from Firestore product docs server-side — never
  // trust an amount computed in the browser.
  const items = [];
  let amount = 0;

  for (const cartDoc of cartSnapshot.docs) {
    const cartData = cartDoc.data();

    const productSnap = await adminDb
      .collection("products")
      .doc(cartData.productId)
      .get();

    if (!productSnap.exists) {
      continue;
    }

    const product = productSnap.data();
    const quantity = Number(cartData.quantity) || 1;
    const lineTotal = product.price * quantity;

    amount += lineTotal;

    items.push({
      productId: cartData.productId,
      name: product.name,
      price: product.price,
      quantity,
      lineTotal
    });
  }

  if (items.length === 0) {
    res.status(400).json({ error: "Your cart items could not be found." });
    return;
  }

  amount = Math.round(amount * 100) / 100;

  const orderRef = adminDb.collection("orders").doc();

  await orderRef.set({
    userId,
    email: decodedToken.email || "",
    items,
    amount,
    status: "pending",
    createdAt: new Date()
  });

  const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
  const [nameFirst, ...nameRest] = (
    decodedToken.name || "Urban Threads customer"
  ).split(" ");

  // Object key order here IS the signing order — do not reorder these
  // without also checking PayFast's field-order requirements.
  const fields = {
    merchant_id: process.env.PAYFAST_MERCHANT_ID,
    merchant_key: process.env.PAYFAST_MERCHANT_KEY,
    return_url: `${appUrl}/checkout-success.html?order=${orderRef.id}`,
    cancel_url: `${appUrl}/checkout-cancel.html?order=${orderRef.id}`,
    notify_url: `${appUrl}/api/payfast-notify`,
    name_first: nameFirst,
    name_last: nameRest.join(" ") || "Customer",
    email_address: decodedToken.email || "",
    m_payment_id: orderRef.id,
    amount: amount.toFixed(2),
    item_name: "Urban Threads order",
    item_description: `${items.length} item(s) from Urban Threads`,
    custom_str1: orderRef.id
  };

  const signature = buildSignature(fields, process.env.PAYFAST_PASSPHRASE);

  res.status(200).json({
    action: PAYFAST_URLS[payfastMode()].process,
    fields: { ...fields, signature }
  });
}