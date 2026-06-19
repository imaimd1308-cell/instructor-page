const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSE6-9ysb53QIKqBM1NNehiBnUB81xGNdo4Fy7xa_3CxKzd_u8smo65BdquDF35jHoMaNlrdQS0HCXq/pub?gid=0&single=true&output=csv";

const columns = {
  visible: "노출",
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

function getBadges(course) {
  const badges = [];
  if (course.applyStart && course.applyStart > today) badges.push(["모집예정", "open"]);
  if (isBetween(course.applyStart, course.applyEnd)) badges.push(["모집중", "open"]);
  if (isBetween(course.courseStart, course.courseEnd)) badges.push(["진행중", "active"]);
  if (course.courseEnd && course.courseEnd < today) badges.push(["종료", "closed"]);
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

function renderStats(courses, open, active, past) {
  document.querySelector("#stats").innerHTML = `
    <article class="stat-card"><strong>${open.length}</strong><span>신청 가능한 강의</span></article>
    <article class="stat-card"><strong>${active.length}</strong><span>진행 중인 강의</span></article>
    <article class="stat-card"><strong>${past.length}</strong><span>강의 이력</span></article>
  `;
}

function classify(courses) {
  const sorted = [...courses].sort((a, b) => a.sort - b.sort);
  const open = sorted.filter((course) => course.applyEnd && today <= course.applyEnd);
  const active = sorted.filter((course) => isBetween(course.courseStart, course.courseEnd));
  const past = sorted.filter((course) => course.courseEnd && course.courseEnd < today);

  return { open, active, past };
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-message]");
  if (!button) return;
  alert(button.dataset.message);
});

async function init() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const rows = parseCsv(await response.text());
    const courses = rows.map(normalizeCourse).filter((course) => course.visible);
    const { open, active, past } = classify(courses);

    renderStats(courses, open, active, past);
    renderList("openCourses", open, "현재 신청 가능한 강의가 없습니다.");
    renderList("activeCourses", active, "현재 진행 중인 강의가 없습니다.");
    renderList("pastCourses", past, "아직 표시할 강의 이력이 없습니다.");
  } catch (error) {
    document.querySelector("#stats").innerHTML = `<div class="empty">구글시트 데이터를 불러오지 못했습니다.</div>`;
  }
}

init();
