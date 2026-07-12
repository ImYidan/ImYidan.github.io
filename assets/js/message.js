(function () {
  "use strict";

  const API_URL = "/api/comments";
  const NAME_KEY = "blog-comment-name";
  const form = document.getElementById("message-form");
  const nameInput = document.getElementById("message-name");
  const contentInput = document.getElementById("message-content");
  const contactInput = document.getElementById("message-contact");
  const publicContactInput = document.getElementById("message-public-contact");
  const contactPrivacy = document.getElementById("message-contact-privacy");
  const contactPanel = document.getElementById("message-contact-panel");
  const contactToggle = document.getElementById("message-contact-toggle");
  const status = document.getElementById("message-form-status");
  const list = document.getElementById("message-list");
  const count = document.getElementById("message-count");
  const submit = form.querySelector("button[type='submit']");
  let replyTarget = null;

  async function readResponse(response, fallback) {
    try {
      return await response.json();
    } catch (_) {
      throw new Error(fallback);
    }
  }

  try {
    nameInput.value = localStorage.getItem(NAME_KEY) || "";
  } catch (_) {
    // The page remains usable when browser storage is unavailable.
  }

  nameInput.addEventListener("change", function () {
    try {
      const name = nameInput.value.trim();
      if (name) localStorage.setItem(NAME_KEY, name);
      else localStorage.removeItem(NAME_KEY);
    } catch (_) {}
  });

  contactToggle.addEventListener("click", function () {
    const isOpen = contactToggle.getAttribute("aria-expanded") === "true";
    contactToggle.setAttribute("aria-expanded", String(!isOpen));
    contactPanel.setAttribute("aria-hidden", String(isOpen));
    contactPanel.classList.toggle("is-open", !isOpen);
    contactInput.tabIndex = isOpen ? -1 : 0;
    publicContactInput.tabIndex = isOpen ? -1 : 0;

    if (!isOpen) {
      window.setTimeout(() => contactInput.focus(), 180);
    } else {
      contactToggle.focus();
    }
  });

  publicContactInput.addEventListener("change", function () {
    contactPrivacy.textContent = publicContactInput.checked
      ? "Contact will be shown publicly with your message"
      : "Contact will not be shared in any way";
    contactPrivacy.classList.toggle("is-public", publicContactInput.checked);
  });

  function formatTime(value) {
    const normalized = /Z$|[+-]\d\d:\d\d$/.test(value)
      ? value
      : `${value.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function renderComment(comment, replies) {
    const article = document.createElement("article");
    article.className = "message-card";

    const header = document.createElement("header");
    header.className = "message-card__header";
    const author = document.createElement("span");
    author.className = "message-card__author";
    author.textContent = comment.name;

    const identity = document.createElement("div");
    identity.className = "message-card__identity";
    identity.append(author);
    if (comment.contact) {
      const contact = document.createElement("span");
      contact.className = "message-card__contact";
      contact.textContent = comment.contact;
      identity.append(contact);
    }

    const time = document.createElement("time");
    time.className = "message-card__time";
    time.dateTime = comment.created_at;
    time.textContent = formatTime(comment.created_at);
    header.append(identity, time);

    const body = document.createElement("p");
    body.className = "message-card__content";
    body.textContent = comment.content;
    const actions = document.createElement("div");
    actions.className = "message-card__actions";
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.className = "message-card__reply-button";
    replyButton.textContent = "Reply";
    replyButton.addEventListener("click", function () {
      replyTarget = comment;
      form.querySelector(".message-reply-context")?.remove();
      const context = document.createElement("div");
      context.className = "message-reply-context";
      const label = document.createElement("span");
      label.textContent = `Replying to ${comment.name}`;
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", function () {
        replyTarget = null;
        context.remove();
      });
      context.append(label, cancel);
      contentInput.closest(".message-field").before(context);
      contentInput.focus();
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    actions.append(replyButton);
    article.append(header, body, actions);

    if (replies.length) {
      const replyList = document.createElement("div");
      replyList.className = "message-card__replies";
      replies.forEach((reply) => replyList.append(renderReply(reply)));
      article.append(replyList);
    }
    return article;
  }

  function renderReply(reply) {
    const item = document.createElement("div");
    item.className = "message-reply";
    const meta = document.createElement("div");
    meta.className = "message-reply__meta";
    const author = document.createElement("strong");
    author.textContent = reply.name;
    const time = document.createElement("time");
    time.dateTime = reply.created_at;
    time.textContent = formatTime(reply.created_at);
    meta.append(author, time);
    const body = document.createElement("p");
    body.textContent = reply.content;
    item.append(meta, body);
    return item;
  }

  function renderComments(comments) {
    list.replaceChildren();
    list.setAttribute("aria-busy", "false");
    count.textContent = `${comments.length} message${comments.length !== 1 ? "s" : ""}`;

    if (!comments.length) {
      const empty = document.createElement("p");
      empty.className = "message-list__notice";
      empty.textContent = "It's quiet here. Be the first to say something.";
      list.append(empty);
      return;
    }
    const repliesByParent = new Map();
    comments.forEach((comment) => {
      if (!comment.parent_id) return;
      const replies = repliesByParent.get(comment.parent_id) || [];
      replies.push(comment);
      repliesByParent.set(comment.parent_id, replies);
    });
    comments
      .filter((comment) => !comment.parent_id)
      .forEach((comment) => list.append(renderComment(comment, repliesByParent.get(comment.id) || [])));
  }

  async function loadComments() {
    try {
      const response = await fetch(API_URL, { headers: { accept: "application/json" } });
      const data = await readResponse(response, "Messages could not be loaded. Please try again later.");
      if (!response.ok) throw new Error(data.error || "Failed to load messages.");
      renderComments(data.comments || []);
    } catch (error) {
      list.setAttribute("aria-busy", "false");
      list.innerHTML = "";
      const notice = document.createElement("p");
      notice.className = "message-list__notice message-list__notice--error";
      notice.textContent = error.message;
      list.append(notice);
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("is-error", "is-success");

    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = "Sending...";

    const fields = new FormData(form);
    const payload = Object.fromEntries(fields.entries());
    payload.public_contact = fields.get("public_contact") === "true";
    if (replyTarget) payload.parent_id = replyTarget.id;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readResponse(response, "Your message could not be saved. Please try again later.");
      if (!response.ok) throw new Error(data.error || "Your message could not be saved.");

      try {
        localStorage.setItem(NAME_KEY, payload.name.trim());
      } catch (_) {}

      contentInput.value = "";
      status.textContent = replyTarget ? "Reply sent. Thank you!" : "Message sent. Thank you!";
      replyTarget = null;
      form.querySelector(".message-reply-context")?.remove();
      status.classList.add("is-success");
      await loadComments();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Send message";
    }
  });

  loadComments();
})();