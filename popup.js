function formatAccessDate(date) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const m = months[date.getMonth()];
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m} ${d}, ${y}`;
}

function formatIsoToLongDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return formatAccessDate(date);
}

function formatIsoToYearMonthDay(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const m = months[date.getMonth()];
  const d = date.getDate();
  const y = date.getFullYear();
  return `${y}, ${m} ${d}`;
}

function formatIsoToShortMonthDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const monthsShort = [
    "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."
  ];
  const m = monthsShort[date.getMonth()];
  const d = date.getDate();
  const y = date.getFullYear();
  return `${m} ${d}, ${y}`;
}

function buildReference(author, title, website, url, posted, updated, accessed) {
  author = author.trim();
  let authorPart = "";
  if (author) {
    if (!author.endsWith(".")) {
      author += ".";
    }
    authorPart = `${author} `;
  }
  let postedPart = "";
  if (posted) {
    postedPart = `${posted}. `;
  }
  let updatedPart = "";
  if (updated) {
    updatedPart = `Updated ${updated}. `;
  }
  return `${authorPart}"${title}." ${website}. ${postedPart}${updatedPart}${url} (accessed ${accessed}).`;
}

function cleanYoutubeTitle(title) {
  let t = title.trim();
  // Remove leading "(59) "-style counters
  t = t.replace(/^\(\d+\)\s*/, "");
  // Remove trailing "- YouTube" or similar
  t = t.replace(/-\s*YouTube.*$/i, "");
  return t.trim();
}

function buildYoutubeReference(author, rawTitle, url, publishedIso, accessed) {
  let cleanAuthor = author.trim();
  let authorPart = "";
  if (cleanAuthor) {
    if (!cleanAuthor.endsWith(".")) {
      cleanAuthor += ".";
    }
    authorPart = `${cleanAuthor} `;
  }

  const title = cleanYoutubeTitle(rawTitle);
  const publishedYearMonthDay = formatIsoToYearMonthDay(publishedIso);
  const publishedShort = formatIsoToShortMonthDate(publishedIso);

  // If we have a valid published date, use full template; otherwise fall back gracefully
  if (publishedYearMonthDay && publishedShort) {
    return `${authorPart}(${publishedYearMonthDay}). ${title}. (${publishedShort}). Accessed: ${accessed}. [Online Video]. Available: ${url}`;
  }

  // Fallback if publish date missing
  return `${authorPart}${title}. Accessed: ${accessed}. [Online Video]. Available: ${url}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const authorInput = document.getElementById("author");
  const titleInput = document.getElementById("title");
  const websiteInput = document.getElementById("website");
  const urlInput = document.getElementById("url");
  const postedInput = document.getElementById("posted");
  const accessedInput = document.getElementById("accessed");
  const output = document.getElementById("output");
  const generateBtn = document.getElementById("generate");
  const copyBtn = document.getElementById("copy");

  // Store extra metadata from the page (e.g. for YouTube)
  let pageMetadata = { isYouTube: false, publishedIso: "", channelName: "" };

  accessedInput.value = formatAccessDate(new Date());

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    titleInput.value = tab.title || "";
    urlInput.value = tab.url || "";

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          const getMeta = (name) =>
            document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ||
            document.querySelector(`meta[property="og:${name}"]`)?.getAttribute("content") ||
            "";

          const author =
            getMeta("author") ||
            document.querySelector('a[rel="author"]')?.textContent?.trim() ||
            "";

          const siteName =
            getMeta("site_name") ||
            document.querySelector('meta[property="og:site_name"]')?.content ||
            document.title.split("|")[1]?.trim() ||
            window.location.hostname;

          const url = window.location.href || "";
          const lowerUrl = url.toLowerCase();
          const isYouTube =
            lowerUrl.includes("youtube.com/") || lowerUrl.includes("youtu.be/");
          let publishedIso =
            document.querySelector('meta[itemprop="datePublished"]')?.getAttribute("content") ||
            document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
            document.querySelector('meta[name="date"]')?.getAttribute("content") ||
            document.querySelector('meta[name="citation_date"]')?.getAttribute("content") ||
            document.querySelector('meta[name="citation_publication_date"]')?.getAttribute("content") ||
            document.querySelector('meta[name="dc.date"]')?.getAttribute("content") ||
            document.querySelector('meta[name="pubdate"]')?.getAttribute("content") ||
            document.querySelector('meta[name="last-modified"]')?.getAttribute("content") ||
            document.querySelector('time[itemprop="dateCreated"]')?.getAttribute("datetime") ||
            document.querySelector('time[itemprop="datePublished"]')?.getAttribute("datetime") ||
            document.querySelector('.relativetime')?.getAttribute("title") ||
            "";

          // ... existing publishedIso extraction logic ...
          if (!publishedIso) {
            // ... existing fallback ...
          }

          let modifiedIso =
            document.querySelector('meta[itemprop="dateModified"]')?.getAttribute("content") ||
            document.querySelector('meta[property="article:modified_time"]')?.getAttribute("content") ||
            document.querySelector('meta[name="revised"]')?.getAttribute("content") ||
            "";

          // Expand JSON-LD search for modified date as well
          if (!publishedIso || !modifiedIso) {
            try {
              const scripts = document.querySelectorAll('script[type="application/ld+json"]');
              for (const script of scripts) {
                const json = JSON.parse(script.textContent);

                const processItem = (item) => {
                  if (item.datePublished && !publishedIso) publishedIso = item.datePublished;
                  if (item.dateModified && !modifiedIso) modifiedIso = item.dateModified;
                };

                if (json.datePublished || json.dateModified) {
                  processItem(json);
                } else if (Array.isArray(json['@graph'])) {
                  json['@graph'].forEach(processItem);
                } else if (Array.isArray(json)) {
                  json.forEach(processItem);
                }

                if (publishedIso && modifiedIso) break;
              }
            } catch (e) {
              // Ignore parse errors
            }
          }

          let channelName = "";
          if (isYouTube) {
            // ... existing youtube logic ...
            const channelLink =
              document.querySelector('#text-container ytd-channel-name a') ||
              document.querySelector('ytd-channel-name a') ||
              document.querySelector('a.yt-simple-endpoint.style-scope.yt-formatted-string');

            if (channelLink) {
              channelName = channelLink.textContent?.trim() || "";
            }
          }

          return { author, siteName, isYouTube, publishedIso, modifiedIso, channelName };
        }
      },
      (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) return;
        const { author, siteName, isYouTube, publishedIso, modifiedIso, channelName } = results[0].result || {};
        if (isYouTube && channelName) {
          authorInput.value = channelName;
        } else if (author) {
          authorInput.value = author;
        }
        if (siteName) websiteInput.value = siteName;
        else if (tab.url) websiteInput.value = new URL(tab.url).hostname;

        if (publishedIso) {
          const formatted = formatAccessDate(new Date(publishedIso));
          postedInput.value = formatted || publishedIso;
        }

        if (modifiedIso) {
          const formatted = formatAccessDate(new Date(modifiedIso));
          document.getElementById("updated").value = formatted || modifiedIso;
        } else if (publishedIso) {
          document.getElementById("updated").value = postedInput.value;
        }

        pageMetadata = {
          isYouTube: Boolean(isYouTube),
          publishedIso: publishedIso || "",
          channelName: channelName || ""
        };
      }
    );
  });

  generateBtn.addEventListener("click", () => {
    const author = authorInput.value.trim();
    const title = titleInput.value.trim();
    const website = websiteInput.value.trim();
    const url = urlInput.value.trim();
    const posted = postedInput.value.trim();
    const updated = document.getElementById("updated").value.trim();
    const accessed = accessedInput.value.trim() || formatAccessDate(new Date());

    if (pageMetadata.isYouTube) {
      output.value = buildYoutubeReference(
        author,
        title,
        url,
        pageMetadata.publishedIso,
        accessed
      );
    } else {
      output.value = buildReference(author, title, website, url, posted, updated, accessed);
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!output.value) return;
    try {
      await navigator.clipboard.writeText(output.value);
    } catch (e) {
      // Clipboard might be blocked; ignore
    }
  });
});
