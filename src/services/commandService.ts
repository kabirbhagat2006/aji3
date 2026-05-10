export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (openMatch) {
    let website = openMatch[1].trim().toLowerCase().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    
    // Add https:// scheme if not present
    let url = website;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      // Avoid adding www if it already has it
      if (!url.startsWith("www.")) {
        url = `https://www.${url}`;
      } else {
        url = `https://${url}`;
      }
    }

    return {
      action: `Opening ${openMatch[1]} for you.`,
      url: url,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(`site:youtube.com ${ytMatch[1].trim()}`);
    return {
      action: `Playing ${ytMatch[1]} on YouTube automatically.`,
      url: `https://www.google.com/search?btnI=1&q=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web
  const waMatchFull = lowerCmd.match(
    /whatsapp\s+(?:message\s+)?(?:to\s+)?([\w\d\+\s]+)\s+(?:saying|that|ki)\s+(.+)$/
  );
  const waMatchMessageOnly = lowerCmd.match(
    /(?:send|type)\s+(?:a\s+)?whatsapp\s+(?:message\s+)?(?:saying|ki)\s+(.+)$/
  );
  
  if (waMatchFull) {
    const contactOrNumber = waMatchFull[1].trim();
    const phoneParam = contactOrNumber.match(/^[\d\+\s]+$/) ? `&phone=${contactOrNumber.replace(/\s+/g, "")}` : "";
    const message = encodeURIComponent(waMatchFull[2].trim());
    return {
      action: `Preparing your WhatsApp message for ${contactOrNumber}.`,
      url: `https://web.whatsapp.com/send?text=${message}${phoneParam}`,
      isBrowserAction: true,
    };
  } else if (waMatchMessageOnly) {
    const message = encodeURIComponent(waMatchMessageOnly[1].trim());
    return {
      action: `Opening WhatsApp to send your message.`,
      url: `https://web.whatsapp.com/send?text=${message}`,
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
