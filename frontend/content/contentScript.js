function extractLinks() {
  const links = document.querySelectorAll("a");
  let linkArray = [];

  links.forEach((link) => {
    if (link.href) {
      linkArray.push(link.href);
    }
  });

  return linkArray;
}

function extractPageText() {
  return document.body.innerText;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageData") {
    sendResponse({
      links: extractLinks(),
      text: extractPageText(),
    });
  }
});
