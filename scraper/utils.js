// Utility functions for human-like behavior and helpers
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = ms => new Promise(res => setTimeout(res, ms));

function randomDelay(min = 2000, max = 8000) {
  return sleep(randomInt(min, max));
}

function randomViewport(viewports) {
  return viewports[randomInt(0, viewports.length - 1)];
}

function randomUserAgent(userAgents) {
  return userAgents[randomInt(0, userAgents.length - 1)];
}

async function humanScroll(page) {
  const scrollHeight = await page.evaluate('document.body.scrollHeight');
  let current = 0;
  while (current < scrollHeight) {
    const step = randomInt(100, 400);
    await page.evaluate(y => window.scrollBy(0, y), step);
    current += step;
    await sleep(randomInt(300, 900));
  }
}

async function humanMouseMove(page) {
  const box = await page.viewport();
  for (let i = 0; i < randomInt(3, 7); i++) {
    await page.mouse.move(
      randomInt(0, box.width),
      randomInt(0, box.height),
      { steps: randomInt(10, 30) }
    );
    await sleep(randomInt(200, 600));
  }
}

module.exports = {
  randomInt,
  sleep,
  randomDelay,
  randomViewport,
  randomUserAgent,
  humanScroll,
  humanMouseMove
};
