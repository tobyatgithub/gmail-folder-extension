// Add this at the top of the file
let isButtonAdded = false;
let lastAction = null;
let undoTimeout = null;
let folderActions = new Map(); // Store undo actions per folder

// Wrap everything in a Gmail-specific check
function initializeGmailExtension() {
  // Only run on Gmail
  if (!window.location.hostname.includes('mail.google.com')) {
    return;
  }

  // Wait for Gmail to be ready
  function waitForGmailToLoad() {
    console.log('Waiting for Gmail to load...');
    
    // Don't start observing until we have the basic Gmail structure
    const gmailViewExists = document.querySelector('.aeH');
    if (!gmailViewExists) {
      setTimeout(waitForGmailToLoad, 500);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      if (isButtonAdded) {
        obs.disconnect();
        return;
      }

      // Try to initialize only when we see Gmail's header
      const gmailHeader = document.querySelector('.gb_Ue, .gb_Td, .G-atb');
      if (gmailHeader) {
        initializeExtension();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start initialization based on document state
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGmailToLoad);
  } else {
    waitForGmailToLoad();
  }
}

// Start the initialization process
try {
  initializeGmailExtension();
} catch (error) {
  console.log('Deferring Gmail extension initialization');
}

function initializeExtension() {
  // Don't add button if it's already there
  if (isButtonAdded || document.querySelector('.organize-emails-btn')) {
    return;
  }

  // Try multiple possible header selectors
  const headerSelectors = [
    '.gb_Qd',                    // Original selector
    '.gb_Td',                    // Alternative selector
    'header .right-items',       // Generic right side
    'header',                    // Fallback to main header
    '.G-tF'                      // Gmail's top bar
  ];

  let headerRight = null;
  for (const selector of headerSelectors) {
    headerRight = document.querySelector(selector);
    if (headerRight) {
      console.log('Found header element with selector:', selector);
      break;
    }
  }

  if (headerRight) {
    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = '📁 整理邮件';
    toggleButton.className = 'organize-emails-btn';
    toggleButton.style.cssText = `
      margin-right: 16px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background-color: #1a73e8;
      color: white;
      cursor: pointer;
      font-family: 'Google Sans',Roboto,RobotoDraft,Helvetica,Arial,sans-serif;
      font-size: 14px;
      line-height: 20px;
    `;
    toggleButton.onclick = organizeEmails;
    
    // Insert at the beginning of the header
    headerRight.insertBefore(toggleButton, headerRight.firstChild);
    console.log('Button successfully added to the header');
    isButtonAdded = true;
    
    // Initialize quick actions
    addQuickActions();
    
    // Watch for new emails and add quick actions to them
    const emailContainer = document.querySelector('.AO');
    if (emailContainer) {
      const observer = new MutationObserver(() => {
        addQuickActions();
      });
      
      observer.observe(emailContainer, {
        childList: true,
        subtree: true
      });
    }
    
    // Create permanent undo button
    createUndoButton();
  } else {
    console.error('Could not find header element to insert button');
  }
}
  
function organizeEmails() {
  // 选择所有邮件行
  const emailRows = Array.from(document.querySelectorAll('tr.zA'));
  
  // Add check for empty results
  if (emailRows.length === 0) {
    alert('未找到邮件。请确保您在收件箱页面并且有可见的邮件。');
    return;
  }
  
  // 创建一个 Map 来存发件人分组的邮件
  const emailsBySender = new Map();
  
  emailRows.forEach(row => {
    const senderElement = row.querySelector('.yP, .zF'); // Gmail 的发件人类
    if (senderElement) {
      const email = senderElement.getAttribute('email');
      const name = senderElement.getAttribute('name');
      
      // Always show both name and email when possible
      let senderKey = email || name;
      let displayName;
      
      if (name && email) {
        displayName = `${name} (${email})`; // Format: "John Doe (john@example.com)"
      } else {
        displayName = email || name; // Fallback to whatever we have
      }
      
      if (!emailsBySender.has(senderKey)) {
        emailsBySender.set(senderKey, {
          displayName: displayName,
          emails: []
        });
      }
      emailsBySender.get(senderKey).emails.push(row);
    }
  });
  
  // 为有多封邮件的发件人创建文件夹
  emailsBySender.forEach((data, senderKey) => {
    if (data.emails.length > 1) {
      createFolder(data.displayName, data.emails);
    }
  });
}
  
function createFolder(senderDisplay, emails) {
  // Store original positions and parent before removing emails
  const originalParent = emails[0].parentNode;
  const originalEmails = emails.map(email => ({
    element: email,
    // Store the next sibling for each email individually
    nextSibling: email.nextElementSibling
  }));
  
  // Create folder elements as before
  const folderContainer = document.createElement('div');
  folderContainer.className = 'email-folder';
  
  const folderHeader = document.createElement('div');
  folderHeader.className = 'folder-header';
  folderHeader.innerHTML = `
    <span class="folder-toggle">▼</span>
    <span class="folder-sender">${senderDisplay}</span>
    <span class="email-count">${emails.length} 封邮件</span>
  `;
  
  const folderContent = document.createElement('div');
  folderContent.className = 'folder-content';
  
  // Sort emails by date to maintain chronological order
  const sortedEmails = emails.sort((a, b) => {
    const dateA = new Date(a.querySelector('.xW').title);
    const dateB = new Date(b.querySelector('.xW').title);
    return dateB - dateA; // Most recent first
  });
  
  // Find the position of the first email (most recent)
  const firstEmail = sortedEmails[0];
  const emailContainer = firstEmail.parentNode;
  
  // Add emails to folder
  sortedEmails.forEach(email => {
    folderContent.appendChild(email.cloneNode(true));
    email.remove();
  });
  
  // Add state persistence
  const folderId = `folder-${senderDisplay.replace(/[^a-zA-Z0-9]/g, '')}`;
  folderContainer.id = folderId;
  
  // Update the toggle logic
  function toggleFolder(isCollapsed) {
    folderContent.classList.toggle('collapsed', isCollapsed);
    const toggleIcon = folderHeader.querySelector('.folder-toggle');
    toggleIcon.classList.toggle('collapsed', isCollapsed);
    toggleIcon.textContent = isCollapsed ? '▶' : '▼';
    
    // Save state
    chrome.storage.local.set({ [folderId]: isCollapsed ? 'collapsed' : 'expanded' });
  }

  // Load saved state
  chrome.storage.local.get(folderId, (result) => {
    const isCollapsed = result[folderId] === 'collapsed';
    toggleFolder(isCollapsed);
  });

  // Handle click events
  folderHeader.addEventListener('click', () => {
    const isCurrentlyCollapsed = folderContent.classList.contains('collapsed');
    toggleFolder(!isCurrentlyCollapsed);
  });

  // Add animation end listener to clean up styles
  folderContent.addEventListener('transitionend', () => {
    if (!folderContent.classList.contains('collapsed')) {
      folderContent.style.overflow = 'auto';
    }
  });
  
  // Assemble folder
  folderContainer.appendChild(folderHeader);
  folderContainer.appendChild(folderContent);
  
  // Create and insert the folder row
  let folderRow = null; // Declare folderRow variable
  if (emailContainer) {
    // Create a wrapper to maintain Gmail's row structure
    folderRow = document.createElement('tr');
    folderRow.className = 'zA folder-row';
    const folderCell = document.createElement('td');
    folderCell.colSpan = '100'; // Span all columns
    folderCell.appendChild(folderContainer);
    folderRow.appendChild(folderCell);
    
    emailContainer.parentNode.insertBefore(folderRow, emailContainer);
    
    // Store this action with a unique folder ID
    folderActions.set(folderId, {
      folder: folderRow,
      originalEmails: originalEmails,
      originalParent: originalParent
      // Remove nextSibling from here since we now store it per email
    });
    
    updateUndoButtonState();
  }
  
  return folderRow;
}

// Add this helper function for smooth scrolling
function scrollIntoViewSmooth(element) {
  const rect = element.getBoundingClientRect();
  const isInViewport = (
    rect.top >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
  );

  if (!isInViewport) {
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Add this after the existing functions
function addQuickActions() {
  const emailRows = Array.from(document.querySelectorAll('tr.zA:not(.has-quick-actions)'));
  const senderFrequency = analyzeSenderFrequency();
  
  emailRows.forEach(row => {
    row.classList.add('has-quick-actions');
    
    const senderElement = row.querySelector('.yP, .zF');
    if (senderElement) {
      const email = senderElement.getAttribute('email');
      const name = senderElement.getAttribute('name');
      const senderKey = email || name;
      const frequency = senderFrequency.get(senderKey) || 0;
      
      if (frequency > 1) {
        // Add frequency badge
        const badge = document.createElement('span');
        badge.className = 'sender-frequency-badge';
        badge.textContent = frequency;
        badge.title = `${frequency} emails from this sender`;
        senderElement.appendChild(badge);
        
        // Add quick-action button at the start of subject
        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'quick-actions';
        
        const groupButton = document.createElement('button');
        groupButton.className = 'quick-group-action';
        groupButton.innerHTML = '📁';
        groupButton.title = '整理此发件人的邮件';
        groupButton.onclick = (e) => {
          e.stopPropagation();
          groupSingleSender(senderKey);
        };
        
        actionsContainer.appendChild(groupButton);
        
        // Find the subject container and insert at the beginning
        const subjectContainer = row.querySelector('.bog');
        if (subjectContainer) {
          // Insert as the first child of .bog
          subjectContainer.insertBefore(actionsContainer, subjectContainer.firstChild);
        }
      }
    }
  });
}

// Helper function to analyze sender frequency
function analyzeSenderFrequency() {
  const senderFrequency = new Map();
  const allRows = document.querySelectorAll('tr.zA');
  
  allRows.forEach(row => {
    const senderElement = row.querySelector('.yP, .zF');
    if (senderElement) {
      const email = senderElement.getAttribute('email');
      const name = senderElement.getAttribute('name');
      const senderKey = email || name;
      
      senderFrequency.set(senderKey, (senderFrequency.get(senderKey) || 0) + 1);
    }
  });
  
  return senderFrequency;
}

// Function to group emails from a single sender
function groupSingleSender(senderKey) {
  const emailRows = Array.from(document.querySelectorAll('tr.zA'));
  const senderEmails = emailRows.filter(row => {
    const senderElement = row.querySelector('.yP, .zF');
    if (senderElement) {
      const email = senderElement.getAttribute('email');
      const name = senderElement.getAttribute('name');
      return (email || name) === senderKey;
    }
    return false;
  });
  
  if (senderEmails.length > 1) {
    // Get sender display name from first email
    const firstSenderElement = senderEmails[0].querySelector('.yP, .zF');
    const email = firstSenderElement.getAttribute('email');
    const name = firstSenderElement.getAttribute('name');
    let displayName;
    
    if (name && email) {
      displayName = `${name} (${email})`;
    } else {
      displayName = email || name;
    }
    
    const folder = createFolder(displayName, senderEmails);
    // Scroll the new folder into view
    setTimeout(() => scrollIntoViewSmooth(folder), 100);
  }
}

// Add this function to handle undo
function createUndoButton() {
  // Remove any existing undo button
  const existingUndo = document.querySelector('.undo-container');
  if (existingUndo) {
    existingUndo.remove();
  }

  const undoContainer = document.createElement('div');
  undoContainer.className = 'undo-container';
  undoContainer.innerHTML = `
    <span>邮件整理记录</span>
    <div class="undo-list"></div>
  `;
  
  document.body.appendChild(undoContainer);
  
  // Remove the auto-hide timeout
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
  
  updateUndoButtonState();
}

// Add new function to update undo button state
function updateUndoButtonState() {
  const undoContainer = document.querySelector('.undo-container');
  if (!undoContainer) return;

  const undoList = undoContainer.querySelector('.undo-list');
  undoList.innerHTML = ''; // Clear existing entries

  if (folderActions.size === 0) {
    undoList.innerHTML = '<span class="no-actions">无整理记录</span>';
    return;
  }

  // Create undo buttons for each folder action
  folderActions.forEach((action, folderId) => {
    const undoEntry = document.createElement('div');
    undoEntry.className = 'undo-entry';
    
    const senderName = action.folder.querySelector('.folder-sender').textContent;
    undoEntry.innerHTML = `
      <span class="undo-sender">${senderName}</span>
      <button class="undo-button">撤销</button>
    `;
    
    const undoButton = undoEntry.querySelector('.undo-button');
    undoButton.onclick = () => {
      const action = folderActions.get(folderId);
      if (action) {
        const { folder, originalEmails, originalParent } = action;
        
        if (!originalParent) {
          console.error('Could not find original parent for undo operation');
          return;
        }
        
        // Remove the folder
        if (folder && folder.parentNode) {
          folder.remove();
        }
        
        // Restore emails to their original positions
        originalEmails.forEach(({ element, nextSibling }) => {
          // Use the stored nextSibling for each individual email
          if (nextSibling && nextSibling.parentNode === originalParent) {
            originalParent.insertBefore(element, nextSibling);
          } else {
            // If nextSibling is no longer valid, append to parent
            originalParent.appendChild(element);
          }
        });
        
        // Remove this action from the map
        folderActions.delete(folderId);
        
        // Update undo button state
        updateUndoButtonState();
        
        // Re-add quick actions to restored emails
        setTimeout(addQuickActions, 0);
      }
    };
    
    undoList.appendChild(undoEntry);
  });
}