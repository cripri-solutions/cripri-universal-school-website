"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const CONTENT_TYPES = new Set(["PHOTOGRAPH", "COMMUNICATION"]);
const MAX_TITLE = 160;
const MAX_BODY = 12000;
const MAX_URL = 2048;

function requireSchoolAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in with your school administrator account.");
  }
  const claims = request.auth.token || {};
  const schoolId = claims.schoolId;
  if (claims.role !== "SCHOOL_ADMIN" || typeof schoolId !== "string" || !schoolId) {
    throw new HttpsError("permission-denied", "Only the authorised school administrator can manage public content.");
  }
  return { schoolId, uid: request.auth.uid };
}

function requireId(value, fieldName) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", fieldName + " is invalid.");
  }
  return value;
}

function requiredText(value, fieldName, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new HttpsError("invalid-argument", fieldName + " is required and must be no longer than " + maxLength + " characters.");
  }
  return value.trim();
}

function optionalHttpsUrl(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > MAX_URL) {
    throw new HttpsError("invalid-argument", "The image URL is invalid.");
  }
  let parsed;
  try { parsed = new URL(value); } catch (_) {
    throw new HttpsError("invalid-argument", "The image URL must be a valid HTTPS URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "Only HTTPS image URLs are accepted.");
  }
  return parsed.toString();
}

async function ensureActiveSchool(schoolId) {
  const school = await db.doc("schools/" + schoolId).get();
  if (!school.exists || school.data().status !== "ACTIVE") {
    throw new HttpsError("permission-denied", "This school account is not active.");
  }
}

function contentRef(schoolId, contentId) {
  return db.doc("schools/" + schoolId + "/siteContent/" + contentId);
}

function auditRef(schoolId) {
  return db.collection("schools/" + schoolId + "/contentAudit").doc();
}

async function recordTransition({ schoolId, uid, contentId, action, nextStatus, extra }) {
  const ref = contentRef(schoolId, contentId);
  const audit = auditRef(schoolId);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "The content item could not be found.");
    const current = snapshot.data();
    const patch = Object.assign({}, extra || {});
    if (nextStatus) patch.status = nextStatus;
    patch.updatedAt = FieldValue.serverTimestamp();
    patch.updatedBy = uid;
    tx.update(ref, patch);
    tx.create(audit, {
      actorUid: uid,
      action,
      contentId,
      contentTitle: current.title || "",
      contentType: current.type || "",
      previousStatus: current.status || "UNKNOWN",
      newStatus: nextStatus || current.status || "UNKNOWN",
      occurredAt: FieldValue.serverTimestamp()
    });
  });
}

exports.saveSiteContent = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);

  const data = request.data || {};
  const title = requiredText(data.title, "Title", MAX_TITLE);
  const body = requiredText(data.body, "Description", MAX_BODY);
  const type = String(data.type || "").toUpperCase();
  if (!CONTENT_TYPES.has(type)) {
    throw new HttpsError("invalid-argument", "Content type must be PHOTOGRAPH or COMMUNICATION.");
  }

  const mediaUrl = optionalHttpsUrl(data.mediaUrl);
  const altText = typeof data.altText === "string" ? data.altText.trim().slice(0, 300) : "";
  if (type === "PHOTOGRAPH" && (!mediaUrl || data.consentConfirmed !== true)) {
    throw new HttpsError("failed-precondition", "A photograph requires an HTTPS image URL and confirmation that publication permission has been obtained.");
  }

  const suppliedId = data.contentId ? requireId(data.contentId, "Content ID") : null;
  const ref = suppliedId ? contentRef(schoolId, suppliedId) : db.collection("schools/" + schoolId + "/siteContent").doc();
  const audit = auditRef(schoolId);
  await db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    if (suppliedId && !old.exists) throw new HttpsError("not-found", "The content item could not be found.");
    if (old.exists && old.data().status === "PERMANENTLY_DELETED") {
      throw new HttpsError("failed-precondition", "Permanently deleted content cannot be edited.");
    }
    const prior = old.exists ? old.data() : {};
    const next = {
      title, body, type, mediaUrl, altText,
      status: old.exists ? (prior.status || "DRAFT") : "DRAFT",
      createdAt: old.exists ? prior.createdAt : FieldValue.serverTimestamp(),
      createdBy: old.exists ? prior.createdBy : uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      consentConfirmed: type === "PHOTOGRAPH" ? true : false
    };
    tx.set(ref, next, { merge: true });
    tx.create(audit, {
      actorUid: uid,
      action: old.exists ? "CONTENT_AMENDED" : "CONTENT_CREATED",
      contentId: ref.id,
      contentTitle: title,
      contentType: type,
      previousStatus: prior.status || "NONE",
      newStatus: next.status,
      occurredAt: FieldValue.serverTimestamp()
    });
  });
  return { contentId: ref.id, status: "DRAFT" };
});

exports.publishSiteContent = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);
  const contentId = requireId(request.data && request.data.contentId, "Content ID");
  const ref = contentRef(schoolId, contentId);
  const audit = auditRef(schoolId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "The content item could not be found.");
    const item = snap.data();
    if (item.status === "RECOVERY" || item.status === "PERMANENTLY_DELETED") {
      throw new HttpsError("failed-precondition", "Restore the item before publishing it.");
    }
    if (item.type === "PHOTOGRAPH" && (item.consentConfirmed !== true || !item.mediaUrl)) {
      throw new HttpsError("failed-precondition", "Photograph publication permission must be confirmed.");
    }
    tx.update(ref, { status: "PUBLISHED", updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
    tx.create(audit, {
      actorUid: uid, action: "CONTENT_PUBLISHED", contentId,
      contentTitle: item.title || "", contentType: item.type || "",
      previousStatus: item.status || "DRAFT", newStatus: "PUBLISHED",
      occurredAt: FieldValue.serverTimestamp()
    });
  });
  return { contentId, status: "PUBLISHED" };
});

exports.withdrawSiteContent = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);
  const contentId = requireId(request.data && request.data.contentId, "Content ID");
  await recordTransition({ schoolId, uid, contentId, action: "CONTENT_WITHDRAWN", nextStatus: "WITHDRAWN" });
  return { contentId, status: "WITHDRAWN" };
});

exports.moveSiteContentToRecovery = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);
  const contentId = requireId(request.data && request.data.contentId, "Content ID");
  await recordTransition({ schoolId, uid, contentId, action: "CONTENT_MOVED_TO_RECOVERY", nextStatus: "RECOVERY" });
  return { contentId, status: "RECOVERY" };
});

exports.restoreSiteContent = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);
  const contentId = requireId(request.data && request.data.contentId, "Content ID");
  const ref = contentRef(schoolId, contentId);
  const audit = auditRef(schoolId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "The content item could not be found.");
    const item = snap.data();
    if (!["RECOVERY", "WITHDRAWN"].includes(item.status)) {
      throw new HttpsError("failed-precondition", "Only withdrawn or recovered content can be restored.");
    }
    tx.update(ref, { status: "DRAFT", updatedAt: FieldValue.serverTimestamp(), updatedBy: uid });
    tx.create(audit, {
      actorUid: uid, action: "CONTENT_RESTORED_AS_DRAFT", contentId,
      contentTitle: item.title || "", contentType: item.type || "",
      previousStatus: item.status, newStatus: "DRAFT",
      occurredAt: FieldValue.serverTimestamp()
    });
  });
  return { contentId, status: "DRAFT" };
});

exports.permanentlyDeleteSiteContent = onCall(async (request) => {
  const { schoolId, uid } = requireSchoolAdmin(request);
  await ensureActiveSchool(schoolId);
  const data = request.data || {};
  const contentId = requireId(data.contentId, "Content ID");
  if (data.confirmPermanentDelete !== true) {
    throw new HttpsError("failed-precondition", "Explicit permanent-deletion confirmation is required.");
  }
  const ref = contentRef(schoolId, contentId);
  const audit = auditRef(schoolId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "The content item could not be found.");
    const item = snap.data();
    if (item.status !== "RECOVERY") {
      throw new HttpsError("failed-precondition", "Move the item to the Recovery Bin before permanent deletion.");
    }
    tx.create(audit, {
      actorUid: uid, action: "CONTENT_PERMANENTLY_DELETED", contentId,
      contentTitle: item.title || "", contentType: item.type || "",
      previousStatus: "RECOVERY", newStatus: "PERMANENTLY_DELETED",
      occurredAt: FieldValue.serverTimestamp()
    });
    tx.delete(ref);
  });
  return { contentId, status: "PERMANENTLY_DELETED" };
});
