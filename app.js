const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSE6-9ysb53QIKqBM1NNehiBnUB81xGNdo4Fy7xa_3CxKzd_u8smo65BdquDF35jHoMaNlrdQS0HCXq/pub?gid=0&single=true&output=csv";

const columns = {
  visible: "노출",
  featured: "추천노출",
  title: "강좌명",
  organization: "기관",
  target: "대상",
  format: "강의방식",
  courseStart: "강의시작일",
  courseEnd: "강의종료일",
  sessions: "회차",
  time: "시간",
  applyStart: "신청시작일",
  applyEnd: "신청마감일",
  applyLink: "신청링크",
  applyMethod: "신청방법",
  summary: "주요내용",
  tags: "태그",
  sort: "정렬"
};

const today = new Date();
today.setHours(0, 0, 0, 0);

let detailCourses = [];
let activeCourses = [];
let pastCourses = [];
let featuredCourse = null;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (value || row.length) {
        row.push(value.trim());
        rows.push(row);
      }
      row = [];
      value = "";
      if (char === "\r" && next === "\n") i += 1;
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some(Boolean))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function isBetween(start, end) {
  if (!start || !end) return false;
  return start <= today && today <= end;
}

function normalizeCourse(row) {
  return {
    visible: row[columns.visible] === "T",
    featured: row[columns.featured] === "T",
    title: row[columns.title],
    organization: row[columns.organization],
    target: row[columns.target],
    format: row[columns.format],
    courseStart: toDate(row[columns.courseStart]),
    courseEnd: toDate(row[columns.courseEnd]),
    sessions: row[columns.sessions],
    time: row[columns.time],
    applyStart: toDate(row[columns.applyStart]),
    applyEnd: toDate(row[columns.applyEnd]),
    applyLink: row[columns.applyLink],
    applyMethod: row[columns.applyMethod],
    summary: row[columns.summary],
    tags: row[columns.tags].split("/").map((tag) => tag.trim()).filter(Boolean),
    sort: Number(row[columns.sort] || 999)
  };
}

function formatDate(date) {
  if (!date) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBadges(course) {
  const badges = [];
  if (course.applyStart && course.applyStart > today) badges.push(["모집예정", "upcoming"]);
  if (isBetween(course.applyStart, course.applyEnd)) badges.push(["모집중", "open"]);
  return badges;
}

function getApplyState(course) {
  if (course.applyStart && course.applyStart > today) {
    return { label: "신청 예정", message: `${formatDate(course.applyStart)}부터 신청할 수 있습니다.` };
  }

  if (course.applyEnd && course.applyEnd < today) {
    return { label: "신청 마감", message: "신청 기간이 마감되었습니다." };
  }

  return { label: "수강 신청", message: "" };
}

function courseCard(course) {
  const badges = getBadges(course);
  const applyState = getApplyState(course);
  const apply =
    applyState.message && applyState.label !== "수강 신청"
      ? `<button class="apply-button muted" type="button" data-message="${applyState.message}">${applyState.label}</button>`
      : course.applyLink
        ? `<a class="apply-button" href="${course.applyLink}" target="_blank" rel="noreferrer">${applyState.label}</a>`
        : course.applyMethod
          ? `<button class="apply-button" type="button" data-message="${course.applyMethod}">${applyState.label}</button>`
          : "";

  return `
    <article class="course-card">
      <div class="badge-row">
        ${badges.map(([label, type]) => `<span class="badge ${type}">${label}</span>`).join("")}
      </div>
      <h3>${course.title}</h3>
      <p class="summary">${course.summary}</p>
      <div class="meta">
        <span>${course.organization} · ${course.target} · ${course.format}</span>
        <span>${formatDate(course.courseStart)} - ${formatDate(course.courseEnd)}</span>
        <span>${course.time} · ${course.sessions}회차</span>
      </div>
      <div class="tag-row">
        ${course.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      ${apply}
    </article>
  `;
}

function renderList(id, courses, emptyText) {
  const target = document.querySelector(`#${id}`);
  target.innerHTML = courses.length
    ? courses.map(courseCard).join("")
    : `<div class="empty">${emptyText}</div>`;
}

function renderFeaturedCourse(courses) {
  const target = document.querySelector("#featuredCourse");
  const featured = courses
    .filter((course) => course.featured && (!course.applyEnd || today <= course.applyEnd))
    .sort((a, b) => a.sort - b.sort)[0];

  if (!featured) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }

  target.hidden = false;
  featuredCourse = featured;
  target.innerHTML = `
    <span class="featured-course-stamp">신규<br />개설</span>
    <div class="featured-course-copy">
      <h2>${escapeHtml(featured.title)}</h2>
      <p class="featured-course-date">강의 시작 <strong>${formatDate(featured.courseStart)}</strong></p>
    </div>
    <button class="featured-course-link" type="button" data-featured-course>강의 보기</button>
  `;
}

function featuredApply(course) {
  const applyState = getApplyState(course);

  if (applyState.message) {
    return `<button class="apply-button muted" type="button" data-message="${applyState.message}">${applyState.label}</button>`;
  }

  if (course.applyLink) {
    return `<a class="apply-button" href="${course.applyLink}" target="_blank" rel="noreferrer">${applyState.label}</a>`;
  }

  if (course.applyMethod) {
    return `<button class="apply-button" type="button" data-message="${course.applyMethod}">${applyState.label}</button>`;
  }

  return "";
}

function openFeaturedModal(course) {
  document.querySelector("#modalBadges").innerHTML = getBadges(course)
    .map(([label, type]) => `<span class="badge ${type}">${label}</span>`)
    .join("");
  document.querySelector("#modalTitle").textContent = course.title;
  document.querySelector("#modalMeta").innerHTML = `
    <span>${escapeHtml(course.organization)} · ${escapeHtml(course.target)} · ${escapeHtml(course.format)}</span>
    <span>${formatDate(course.courseStart)} - ${formatDate(course.courseEnd)}</span>
    <span>${escapeHtml(course.time)} · ${escapeHtml(course.sessions)}회차</span>
  `;
  document.querySelector("#modalSummary").textContent = course.summary;
  document.querySelector("#modalTags").innerHTML = course.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  document.querySelector("#modalApply").innerHTML = featuredApply(course);
  document.querySelector("#courseModal").classList.add("is-open");
  document.querySelector("#courseModal").setAttribute("aria-hidden", "false");
}

function courseRow(course, index) {
  return `
    <button class="course-row" type="button" data-course-index="${index}">
      <strong>${escapeHtml(course.title)}</strong>
      <span>${escapeHtml(course.organization)}</span>
      <em>${formatDate(course.courseStart)} - ${formatDate(course.courseEnd)}</em>
    </button>
  `;
}

function renderCompactList(id, courses, emptyText, indexOffset) {
  const target = document.querySelector(`#${id}`);
  target.innerHTML = courses.length
    ? courses.map((course, index) => courseRow(course, index + indexOffset)).join("")
    : `<div class="empty">${emptyText}</div>`;
}

function renderHistory(filter = "") {
  const filteredPast = filter
    ? pastCourses.filter((course) => course.organization === filter).sort(compareByCourseStartDesc)
    : [...pastCourses].sort(compareByCourseStartDesc);

  detailCourses = [...activeCourses, ...filteredPast];
  renderCompactList("pastCourses", filteredPast, "조건에 맞는 강의 이력이 없습니다.", activeCourses.length);
}

function renderHistoryFilter(courses) {
  const filter = document.querySelector("#historyFilter");
  const organizations = [...new Set(courses.map((course) => course.organization).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  filter.innerHTML = `
    <option value="">전체 기관</option>
    ${organizations.map((organization) => `<option value="${escapeHtml(organization)}">${escapeHtml(organization)}</option>`).join("")}
  `;
}

function renderStats(courses, open, active, past) {
  document.querySelector("#stats").innerHTML = `
    <a class="stat-card" href="#open-section"><span class="stat-open">모집중</span><strong>${open.length}</strong></a>
    <a class="stat-card" href="#active-section"><span class="stat-now">진행중</span><strong>${active.length}</strong></a>
    <a class="stat-card" href="#past-section"><span class="stat-archive">강의 이력</span><strong>${past.length}</strong></a>
  `;
}

function compareByCourseStartDesc(a, b) {
  return b.courseStart - a.courseStart || b.courseEnd - a.courseEnd || a.title.localeCompare(b.title, "ko");
}

function classify(courses) {
  const sorted = [...courses].sort((a, b) => a.sort - b.sort);
  const open = sorted.filter((course) => course.applyEnd && today <= course.applyEnd);
  const active = sorted.filter((course) => isBetween(course.courseStart, course.courseEnd)).sort(compareByCourseStartDesc);
  const past = sorted
    .filter((course) => course.courseEnd && course.courseEnd < today)
    .sort(compareByCourseStartDesc);

  return { open, active, past };
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-message]");
  if (!button) return;
  alert(button.dataset.message);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-featured-course]") || !featuredCourse) return;
  openFeaturedModal(featuredCourse);
});

document.addEventListener("click", (event) => {
  const row = event.target.closest("[data-course-index]");
  if (!row) return;

  const course = detailCourses[Number(row.dataset.courseIndex)];
  if (!course) return;

  document.querySelector("#modalTitle").textContent = course.title;
  document.querySelector("#modalMeta").innerHTML = `
    <span>${escapeHtml(course.organization)} · ${escapeHtml(course.target)}</span>
    <span>${formatDate(course.courseStart)} - ${formatDate(course.courseEnd)}</span>
    <span>${escapeHtml(course.time)} · ${escapeHtml(course.sessions)}회차</span>
  `;
  document.querySelector("#modalSummary").textContent = course.summary;
  document.querySelector("#modalTags").innerHTML = course.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  document.querySelector("#courseModal").classList.add("is-open");
  document.querySelector("#courseModal").setAttribute("aria-hidden", "false");
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-close-modal]")) return;
  document.querySelector("#courseModal").classList.remove("is-open");
  document.querySelector("#courseModal").setAttribute("aria-hidden", "true");
});

document.querySelector("#historyFilter").addEventListener("change", (event) => {
  renderHistory(event.target.value);
});

async function init() {
  try {
    const response = await fetch(`${SHEET_CSV_URL}&v=${Date.now()}`);
    const rows = parseCsv(await response.text());
    const courses = rows.map(normalizeCourse).filter((course) => course.visible);
    const { open, active, past } = classify(courses);
    activeCourses = active;
    pastCourses = past;
    detailCourses = [...activeCourses, ...pastCourses];

    renderFeaturedCourse(courses);
    renderStats(courses, open, active, past);
    renderList("openCourses", open, "현재 신청 가능한 강의가 없습니다.");
    renderCompactList("activeCourses", active, "현재 진행 중인 강의가 없습니다.", 0);
    renderHistoryFilter(courses);
    renderHistory();
  } catch (error) {
    document.querySelector("#stats").innerHTML = `<div class="empty">구글시트 데이터를 불러오지 못했습니다.</div>`;
  }
}

init();
