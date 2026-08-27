const curriculum = require('./ctf_curriculum_roadmap.json');

const CATEGORY_KEYS = {
  Web: 'Web',
  Cryptography: 'Cryptography',
  Forensics: 'Forensics',
  Reverse: 'Reverse',
  binary_exploitation: 'binary_exploitation',
  osint_misc: 'osint_misc',
};

function getCategoryData(key) {
  return curriculum.categories.find(c => c.category === key);
}

function getStages(categoryKey, learnerType) {
  const data = getCategoryData(categoryKey);
  if (!data) return [];
  const paths = data.paths || {};
  if (paths[learnerType]) return paths[learnerType].stages || [];
  if (paths.common) return paths.common.stages || [];
  const first = Object.values(paths)[0];
  return first ? first.stages || [] : [];
}

function joinTopics(topics) {
  if (!topics) return [];
  if (Array.isArray(topics)) {
    return topics.map(t => (typeof t === 'string' ? t : t?.title)).filter(Boolean);
  }
  const out = [];
  for (const [, value] of Object.entries(topics)) {
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (typeof v === 'string') out.push(v);
        else if (v?.title) out.push(v.title);
      });
    } else if (typeof value === 'string') {
      out.push(value);
    }
  }
  return out;
}

function joinResources(resources) {
  if (!resources) return [];
  const out = [];
  const visit = (arr) => {
    if (Array.isArray(arr)) {
      arr.forEach(r => {
        if (r?.title) out.push(r.title);
      });
    }
  };
  if (Array.isArray(resources)) {
    visit(resources);
  } else if (typeof resources === 'object') {
    for (const value of Object.values(resources)) {
      if (Array.isArray(value)) visit(value);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  return out;
}

function buildTasksForStage(stage, index, prefix) {
  const title = stage.title || `Stage ${index + 1}`;
  const topics = joinTopics(stage.topics);
  const resources = joinResources(stage.resources);
  const tasks = [];

  tasks.push(
    `📘 [${prefix}] Read/study: **${title}** – take handwritten notes and define 3 key takeaways.`
  );

  if (topics.length) {
    const sample = topics.slice(0, 3).join(', ');
    tasks.push(
      `🔎 [${prefix}] List the core concepts from **${title}** and write a 1-line definition for each: ${sample}.`
    );
  }

  if (resources.length) {
    const pick = resources.slice(0, 2).join(' and ');
    tasks.push(
      `📚 [${prefix}] Open at least one resource (${pick}) and finish 1 chapter / 1 module / 1 video from **${title}**.`
    );
  }

  if (Array.isArray(stage.sequence) && stage.sequence.length) {
    tasks.push(
      `🧭 [${prefix}] Follow the suggested order for **${title}**: do step 1 → ${stage.sequence[0]}.`
    );
  } else {
    tasks.push(
      `🛠️ [${prefix}] Build a tiny demo / lab applying one idea from **${title}** and save it to your notes.`
    );
  }

  return tasks;
}

function buildTasksForCategory(categoryKey, learnerType) {
  const stages = getStages(categoryKey, learnerType);
  if (stages.length === 0) return [];
  const prefix = `Stage ${stages.length} ahead`;
  const tasks = [];
  stages.forEach((stage, idx) => {
    tasks.push(...buildTasksForStage(stage, idx, `Stage ${idx + 1}/${stages.length}`));
  });
  tasks.push(
    `🧠 [${prefix}] Summarize what you learned in 5 bullet points and post a one-paragraph reflection in your private log.`
  );
  tasks.push(
    `🎯 [${prefix}] Pick 1 weak area from the stage and schedule a 25-min focused drill tomorrow.`
  );
  return tasks;
}

const tasks = {};
for (const [shortKey, jsonKey] of Object.entries(CATEGORY_KEYS)) {
  const book = buildTasksForCategory(jsonKey, 'book');
  const visual = buildTasksForCategory(jsonKey, 'visual');
  if (book.length === 0 && visual.length === 0) continue;
  tasks[shortKey] = {
    book: book.length ? book : visual,
    visual: visual.length ? visual : book,
  };
}

const FALLBACK_TASKS = {
  book: [
    '📘 Read 10 pages from your main CTF book and write 3 key takeaways.',
    '🔎 Define every new term you met today in your own words.',
    '📚 Finish one chapter/module from your current roadmap stage.',
    '🧠 Summarize the day in 5 bullet points and pick tomorrow’s focus.',
  ],
  visual: [
    '🎥 Watch one focused tutorial on your current stage and pause to take notes.',
    '🔎 Recreate the demo shown in the video from scratch.',
    '📚 Complete one module/lab on your practice platform.',
    '🧠 Summarize the day in 5 bullet points and pick tomorrow’s focus.',
  ],
};

for (const key of Object.keys(tasks)) {
  if (!tasks[key].book || tasks[key].book.length === 0) tasks[key].book = FALLBACK_TASKS.book;
  if (!tasks[key].visual || tasks[key].visual.length === 0) tasks[key].visual = FALLBACK_TASKS.visual;
}

const allTemplates = [];
for (const [category, paths] of Object.entries(tasks)) {
  for (const [learnerType, list] of Object.entries(paths)) {
    list.forEach((text, idx) => {
      const stageMatch = text.match(/\[Stage (\d+)\/(\d+)\]/);
      allTemplates.push({
        category,
        learnerType,
        taskText: text,
        stage: stageMatch ? `Stage ${stageMatch[1]}` : null,
        order: idx,
      });
    });
  }
}

module.exports = {
  tasks,
  allTemplates,
  CATEGORY_KEYS,
};
