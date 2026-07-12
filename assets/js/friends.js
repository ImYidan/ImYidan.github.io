(function () {
  "use strict";

  const network = document.getElementById("friend-network");
  if (!network) return;

  const people = Array.from(network.querySelectorAll(".friend-bubble--person"));
  const self = network.querySelector(".friend-bubble--self");
  const lines = document.getElementById("friend-network-lines");
  const toast = document.getElementById("friend-toast");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const MAX_DRIFT = 6;
  const MAX_DRIFT_SPEED = 0.00032;
  const ORBIT_SPEED = 0.0000045;
  const HOVER_SHIFT = 5;
  const FRIEND_ACCENTS = ["sora", "matcha", "yuzu", "sumire"];
  const nodes = [];
  const selfMotion = { currentX: 0, currentY: 0, targetX: 0, targetY: 0, hoverAmount: 0, targetHover: 0 };
  let center = { x: 0, y: 0 };
  let orbitOffset = 0;
  let lastFrameTime = 0;
  let bubbleHovered = false;
  let animationFrame;
  let toastTimer;

  function unicodeSeed(text) {
    let hash = 2166136261;
    Array.from(text).forEach((character) => {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return hash >>> 0;
  }

  function layout() {
    const width = network.clientWidth;
    const height = network.clientHeight;
    const cx = width / 2;
    const cy = height / 2;
    center = { x: cx, y: cy };
    const compact = width < 560;
    const rx = Math.max(105, width * (compact ? 0.34 : 0.38));
    const ry = Math.max(115, height * 0.36);
    lines.setAttribute("viewBox", `0 0 ${width} ${height}`);
    lines.replaceChildren();
    nodes.length = 0;

    people.forEach((person, index) => {
      const seed = unicodeSeed(person.textContent.trim());
      person.classList.remove(...FRIEND_ACCENTS.map((accent) => `friend-bubble--${accent}`));
      person.classList.add(`friend-bubble--${FRIEND_ACCENTS[seed % FRIEND_ACCENTS.length]}`);
      const angleJitter = (((seed >>> 8) % 1000) / 1000 - 0.5) * Math.min(0.34, 1.2 / people.length);
      const radiusFactor = 0.86 + ((seed % 1000) / 1000) * 0.25;
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / people.length + angleJitter;
      const nodeRx = rx * radiusFactor;
      const nodeRy = ry * (0.9 + (((seed >>> 16) % 1000) / 1000) * 0.2);
      const x = cx + Math.cos(angle) * nodeRx;
      const y = cy + Math.sin(angle) * nodeRy;
      person.style.left = `${x}px`;
      person.style.top = `${y}px`;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", cx);
      line.setAttribute("y1", cy);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      lines.appendChild(line);
      nodes.push({
        element: person,
        line,
        angle,
        rx: nodeRx,
        ry: nodeRy,
        phase: index * 1.73 + ((seed >>> 4) % 100) / 125,
        speed: Math.min(MAX_DRIFT_SPEED, 0.00022 + (index % 4) * 0.000025),
        amplitude: Math.min(MAX_DRIFT, 4 + (index % 3)),
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        hoverAmount: 0,
        targetHover: 0
      });
    });

    self.style.left = `${cx}px`;
    self.style.top = `${cy}px`;
  }

  function animate(time) {
    const still = reduceMotion.matches;
    const delta = lastFrameTime ? Math.min(32, time - lastFrameTime) : 0;
    const easing = reduceMotion.matches ? 1 : Math.min(1, delta / 90);
    lastFrameTime = time;
    if (!still && !bubbleHovered) orbitOffset += delta * ORBIT_SPEED;
    selfMotion.currentX += (selfMotion.targetX - selfMotion.currentX) * easing;
    selfMotion.currentY += (selfMotion.targetY - selfMotion.currentY) * easing;
    selfMotion.hoverAmount += (selfMotion.targetHover - selfMotion.hoverAmount) * easing;
    const selfBaseX = still ? 0 : Math.sin(time * 0.00018) * 3;
    const selfBaseY = still ? 0 : Math.cos(time * 0.00015) * 2.2;
    const selfDx = selfBaseX * (1 - selfMotion.hoverAmount) + selfMotion.currentX;
    const selfDy = selfBaseY * (1 - selfMotion.hoverAmount) + selfMotion.currentY;
    const movingCenter = { x: center.x + selfDx, y: center.y + selfDy };
    self.style.transform = `translate(-50%, -50%) translate(${selfDx}px, ${selfDy}px)`;

    nodes.forEach((node) => {
      const orbitAngle = node.angle + orbitOffset;
      const baseX = movingCenter.x + Math.cos(orbitAngle) * node.rx;
      const baseY = movingCenter.y + Math.sin(orbitAngle) * node.ry;
      node.currentX += (node.targetX - node.currentX) * easing;
      node.currentY += (node.targetY - node.currentY) * easing;
      node.hoverAmount += (node.targetHover - node.hoverAmount) * easing;
      const driftX = still ? 0 : Math.sin(time * node.speed + node.phase) * node.amplitude;
      const driftY = still ? 0 : Math.cos(time * node.speed * 0.83 + node.phase * 1.4) * node.amplitude * 0.72;
      let dx = driftX * (1 - node.hoverAmount) + node.currentX;
      let dy = driftY * (1 - node.hoverAmount) + node.currentY;

      node.element.style.left = `${baseX}px`;
      node.element.style.top = `${baseY}px`;
      node.element.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
      node.line.setAttribute("x1", movingCenter.x);
      node.line.setAttribute("y1", movingCenter.y);
      node.line.setAttribute("x2", baseX + dx);
      node.line.setAttribute("y2", baseY + dy);
    });
    animationFrame = requestAnimationFrame(animate);
  }

  function positionHint(event) {
    if (!event || typeof event.clientX !== "number") {
      const width = toast.offsetWidth || 180;
      toast.style.left = `${Math.max(12, (window.innerWidth - width) / 2)}px`;
      toast.style.top = "auto";
      toast.style.bottom = "24px";
      return;
    }
    const gap = 14;
    const width = toast.offsetWidth || 180;
    const height = toast.offsetHeight || 40;
    const left = Math.min(window.innerWidth - width - 12, event.clientX + gap);
    const top = Math.min(window.innerHeight - height - 12, event.clientY + gap);
    toast.style.left = `${Math.max(12, left)}px`;
    toast.style.top = `${Math.max(12, top)}px`;
    toast.style.bottom = "auto";
  }

  function showHint(message, bubble, event) {
    toast.textContent = message;
    if (bubble) {
      const styles = getComputedStyle(bubble);
      toast.style.setProperty("--hint-accent", styles.getPropertyValue("--bubble-color"));
      toast.style.setProperty("--hint-soft", styles.getPropertyValue("--bubble-soft"));
      toast.style.setProperty("--hint-ink", styles.getPropertyValue("--bubble-ink"));
    }
    toast.hidden = false;
    positionHint(event);
    toast.classList.remove("friend-toast--show");
    requestAnimationFrame(() => toast.classList.add("friend-toast--show"));
    clearTimeout(toastTimer);
  }

  function hideHint() {
    clearTimeout(toastTimer);
    toast.classList.remove("friend-toast--show");
    toastTimer = setTimeout(() => { toast.hidden = true; }, 220);
  }

  function entryShift(bubble, event) {
    if (!event || typeof event.clientX !== "number") return { x: 0, y: 0 };
    const rect = bubble.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - event.clientX;
    const dy = rect.top + rect.height / 2 - event.clientY;
    const distance = Math.hypot(dx, dy) || 1;
    return { x: dx / distance * HOVER_SHIFT, y: dy / distance * HOVER_SHIFT };
  }

  function setHoverMotion(bubble, hovered, event) {
    const motion = bubble === self ? selfMotion : nodes.find((node) => node.element === bubble);
    if (!motion) return;
    const shift = hovered ? entryShift(bubble, event) : { x: 0, y: 0 };
    motion.targetHover = hovered ? 1 : 0;
    motion.targetX = shift.x;
    motion.targetY = shift.y;
  }

  people.forEach((person) => {
    person.addEventListener("click", (event) => {
      if (person.dataset.url) {
        window.location.href = person.dataset.url;
      } else {
        showHint("Site under construction", person, event);
      }
    });
  });

  [self, ...people].forEach((bubble) => {
    const message = bubble === self
      ? "You are here"
      : bubble.dataset.url ? "Opens an external link" : "External site under construction";
    bubble.addEventListener("mouseenter", (event) => {
      bubbleHovered = true;
      setHoverMotion(bubble, true, event);
      showHint(message, bubble, event);
    });
    bubble.addEventListener("mousemove", positionHint, { passive: true });
    bubble.addEventListener("mouseleave", () => {
      bubbleHovered = false;
      setHoverMotion(bubble, false);
      hideHint();
    });
    bubble.addEventListener("focus", () => {
      bubbleHovered = true;
      setHoverMotion(bubble, true);
      showHint(message, bubble);
    });
    bubble.addEventListener("blur", () => {
      bubbleHovered = false;
      setHoverMotion(bubble, false);
      hideHint();
    });
  });

  self.addEventListener("click", (event) => {
    showHint("You are here", self, event);
  });

  layout();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animate);
  window.addEventListener("resize", layout, { passive: true });
})();
