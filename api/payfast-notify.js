import { adminDb } from "../lib/firebase-admin.js";
import { buildSignature, PAYFAST_URLS, payfastMode } from "../lib/payfast.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // Vercel parses application/x-www-form-urlencoded bodies into
  // req.body automatically, preserving field order.
  const pfData = req.body || {};

  // Step 1: the signature PayFast sent must match one we compute
  // ourselves from the same data and our passphrase.
  const receivedSignature = pfData.signature;
  const expectedSignature = buildSignature(
    pfData,
    process.env.PAYFAST_PASSPHRASE
  );

  if (!receivedSignature || receivedSignature !== expectedSignature) {
    console.error("payfast-notify: signature mismatch.");
    res.status(400).end();
    return;
  }

  // Step 2: confirm the notification with PayFast's own servers
  // before trusting it — a forged POST could pass step 1 if it also
  // guessed a valid signature format, so PayFast requires this
  // round-trip as the real source of truth.
  const validateResponse = await fetch(PAYFAST_URLS[payfastMode()].validate, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(pfData).toString()
  });

  const validateText = (await validateResponse.text()).trim();

  if (validateText !== "VALID") {
    console.error("payfast-notify: PayFast did not confirm this ITN.");
    res.status(400).end();
    return;
  }

  const orderId = pfData.m_payment_id;
  const orderRef = adminDb.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    console.error("payfast-notify: unknown order:", orderId);
    res.status(404).end();
    return;
  }

  const order = orderSnap.data();

  // Step 3: the paid amount must match what we quoted, so a tampered
  // amount field can't slip a cheaper "paid" order through.
  const paidAmount = Number(pfData.amount_gross);

  if (Number.isNaN(paidAmount) || Math.abs(paidAmount - order.amount) > 0.01) {
    console.error(
      "payfast-notify: amount mismatch.",
      paidAmount,
      order.amount
    );

    res.status(400).end();
    return;
  }

  if (pfData.payment_status === "COMPLETE") {
    await orderRef.update({
      status: "paid",
      paidAt: new Date(),
      payfastPaymentId: pfData.pf_payment_id || null
    });

    const cartSnapshot = await adminDb
      .collection("users")
      .doc(order.userId)
      .collection("cart")
      .get();

    const batch = adminDb.batch();
    cartSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } else {
    await orderRef.update({
      status: String(pfData.payment_status || "unknown").toLowerCase()
    });
  }

  res.status(200).end();
}