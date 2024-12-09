// Add this at the top of the file
let isButtonAdded = false;
let lastAction = null;
let undoTimeout = null;
let folderActions = new Map(); // Store undo actions per folder
const ONE_DAY = 24 * 60 * 60 * 1000; // milliseconds

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
    
    // Restore folders after initialization
    setTimeout(restoreStoredFolders, 1000); // Give Gmail time to load emails
    
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
  
  // 为有封邮件的发件人创建文件夹
  emailsBySender.forEach((data, senderKey) => {
    if (data.emails.length > 1) {
      createFolder(data.displayName, data.emails);
    }
  });
}
  
function createFolder(senderDisplay, emails) {
    // Store original positions with full context
    const originalPositions = emails.map(email => {
        return {
            email: email,
            nextSibling: email.nextElementSibling,
            parentNode: email.parentElement,
            position: {
                previousSibling: email.previousElementSibling,
                nextSibling: email.nextElementSibling
            }
        };
    });

    const folderRow = document.createElement('tr');
    folderRow.className = 'zA folder-header';
    
    // Create folder header following Gmail's structure
    folderRow.innerHTML = `
        <td class="PF xY"></td>
        <td class="oZ-x3 xY"></td>
        <td class="apU xY"></td>
        <td class="WA xY"></td>
        <td class="yX xY" role="gridcell">
            <span class="folder-toggle">▼</span>
            <span class="folder-sender">${senderDisplay}</span>
            <span class="email-count">(${emails.length})</span>
        </td>
        <td class="a4W xY"></td>
        <td class="byZ xY"></td>
        <td class="xW xY">
            <button class="folder-undo-button" title="撤销此分组">撤销</button>
        </td>
        <td class="bq4 xY"></td>
    `;

    // Get the parent table
    const parentTable = emails[0].parentElement;
    if (!parentTable) {
        console.error('Could not find parent table');
        return null;
    }

    console.log('Found parent table:', parentTable);

    // Insert folder row before the first email
    try {
        parentTable.insertBefore(folderRow, emails[0]);
        console.log('Folder row inserted');

        // Move emails under the folder
        emails.forEach((email, index) => {
            email.classList.add('folder-email');
            // Always move the email right after the folder or the last moved email
            const referenceNode = index === 0 ? folderRow : emails[index - 1];
            parentTable.insertBefore(email, referenceNode.nextSibling);
            console.log(`Moved email ${index + 1} of ${emails.length}`);
        });

        // Add toggle functionality
        const toggleButton = folderRow.querySelector('.folder-toggle');
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = toggleButton.textContent === '▼';
            toggleButton.textContent = isExpanded ? '▶' : '▼';
            
            let nextElement = folderRow.nextElementSibling;
            while (nextElement && nextElement.classList.contains('folder-email')) {
                nextElement.style.display = isExpanded ? 'none' : '';
                nextElement = nextElement.nextElementSibling;
            }
        });

        // Add undo functionality with position restoration
        const undoButton = folderRow.querySelector('.folder-undo-button');
        undoButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove folder row first
            folderRow.remove();
            
            // Restore emails in reverse order to maintain correct positioning
            [...originalPositions].reverse().forEach(({email, position, parentNode}) => {
                email.classList.remove('folder-email');
                email.style.display = '';
                
                // Try to find the best reference point for insertion
                let referenceNode = null;
                
                // First try the original next sibling
                if (position.nextSibling && position.nextSibling.parentNode === parentNode) {
                    referenceNode = position.nextSibling;
                }
                // If no valid next sibling, try inserting after the previous sibling
                else if (position.previousSibling && position.previousSibling.parentNode === parentNode) {
                    referenceNode = position.previousSibling.nextSibling;
                }
                
                // Insert the email at its original position
                if (referenceNode) {
                    parentNode.insertBefore(email, referenceNode);
                } else {
                    // If no reference points exist, append to parent
                    parentNode.appendChild(email);
                }
            });
        });

        console.log('Folder creation complete');
        return folderRow;
    } catch (error) {
        console.error('Error creating folder:', error);
        return null;
    }
}

// Add this helper function for smooth scrolling
function scrollIntoViewSmooth(element) {
    if (!element) {
        console.warn('Attempted to scroll to a non-existent element');
        return;
    }

    try {
        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        );

        if (!isInViewport) {
            element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest' 
            });
        }
    } catch (error) {
        console.warn('Error while attempting to scroll:', error);
    }
}

// Add this after the existing functions
function addQuickActions() {
    console.log('Adding quick actions...'); // Debug log
    
    const emailRows = Array.from(document.querySelectorAll('tr.zA:not(.has-quick-actions)'));
    const senderFrequency = analyzeSenderFrequency();
    
    emailRows.forEach(row => {
        console.log('Processing row:', row); // Debug log
        
        row.classList.add('has-quick-actions');
        
        const senderElement = row.querySelector('.yP, .zF');
        if (senderElement) {
            const email = senderElement.getAttribute('email');
            const name = senderElement.getAttribute('name');
            const senderKey = email || name;
            const frequency = senderFrequency.get(senderKey) || 0;
            
            console.log('Sender info:', { email, name, frequency }); // Debug log
            
            if (frequency > 1) {
                // Add quick-action button at the start of subject
                const subjectContainer = row.querySelector('.bog');
                if (subjectContainer) {
                    const actionsContainer = document.createElement('span');
                    actionsContainer.className = 'quick-actions';
                    
                    const groupButton = document.createElement('button');
                    groupButton.className = 'quick-group-action';
                    groupButton.innerHTML = '📁';
                    groupButton.title = '整理此发件人的邮件';
                    
                    // Add explicit click handler
                    groupButton.addEventListener('click', (e) => {
                        console.log('Quick action button clicked'); // Debug log
                        e.stopPropagation();
                        e.preventDefault();
                        groupSingleSender(senderKey);
                    });
                    
                    actionsContainer.appendChild(groupButton);
                    subjectContainer.insertBefore(actionsContainer, subjectContainer.firstChild);
                    
                    console.log('Added quick action button for:', senderKey); // Debug log
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
    console.log('Starting groupSingleSender for:', senderKey); // Debug log
    
    const emailRows = Array.from(document.querySelectorAll('tr.zA'));
    console.log('Total email rows found:', emailRows.length); // Debug log
    
    const senderEmails = emailRows.filter(row => {
        const senderElement = row.querySelector('.yP, .zF');
        if (senderElement) {
            const email = senderElement.getAttribute('email');
            const name = senderElement.getAttribute('name');
            const matches = (email || name) === senderKey;
            console.log('Checking email:', { email, name, senderKey, matches }); // Debug log
            return matches;
        }
        return false;
    });
    
    console.log('Filtered sender emails:', senderEmails.length); // Debug log
    
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
        
        console.log('Creating folder with display name:', displayName); // Debug log
        
        // Get the parent table before creating the folder
        const parentTable = senderEmails[0].parentElement;
        if (!parentTable) {
            console.error('Could not find parent table for emails');
            return;
        }
        
        const folder = createFolder(displayName, senderEmails);
        console.log('Folder created:', folder); // Debug log
        
        if (folder && folder.parentElement) {
            requestAnimationFrame(() => {
                scrollIntoViewSmooth(folder);
            });
        } else {
            console.error('Folder was not properly inserted into DOM');
        }
    } else {
        console.log('Not enough emails found for grouping');
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
      <button class="undo-button">销</button>
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
        
        // Remove the folder first
        if (folder && folder.parentNode) {
          folder.remove();
        }
        
        // Create all email elements first
        const restoredEmails = originalEmails.map(({ data }) => {
          const restoredEmail = document.createElement('tr');
          restoredEmail.className = 'zA yO';
          
          data.forEach(cellData => {
            const td = document.createElement('td');
            td.className = cellData.className;
            td.innerHTML = cellData.innerHTML;
            restoredEmail.appendChild(td);
          });
          
          return restoredEmail;
        });
        
        // Now restore them in their original positions
        restoredEmails.forEach((restoredEmail, index) => {
          const originalPosition = originalEmails[index].position;
          
          // Try to find a valid reference point
          let referenceNode = null;
          
          // First try the previous sibling's next sibling
          if (originalPosition.previousSibling && 
              originalPosition.previousSibling.parentNode === originalParent) {
            referenceNode = originalPosition.previousSibling.nextSibling;
          }
          // Then try the next sibling
          else if (originalPosition.nextSibling && 
                   originalPosition.nextSibling.parentNode === originalParent) {
            referenceNode = originalPosition.nextSibling;
          }
          // Finally, if no reference points exist, append to parent
          
          if (referenceNode) {
            originalParent.insertBefore(restoredEmail, referenceNode);
          } else {
            originalParent.appendChild(restoredEmail);
          }
          
          // Re-initialize Gmail's event handlers
          const event = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          restoredEmail.dispatchEvent(event);
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

// Move the undo logic to a separate function
function undoFolderAction(folderId) {
  const action = folderActions.get(folderId);
  if (!action) return;

  const { folder, originalEmails, originalParent } = action;
  
  if (!originalParent) {
    console.error('Could not find original parent for undo operation');
    return;
  }
  
  // Remove the folder
  if (folder && folder.parentNode) {
    folder.remove();
  }
  
  // Create and restore all email elements
  const restoredEmails = originalEmails.map(({ data }) => {
    const restoredEmail = document.createElement('tr');
    restoredEmail.className = 'zA yO';
    
    data.forEach(cellData => {
      const td = document.createElement('td');
      td.className = cellData.className;
      td.innerHTML = cellData.innerHTML;
      restoredEmail.appendChild(td);
    });
    
    return restoredEmail;
  });
  
  // Restore emails to their original positions
  restoredEmails.forEach((restoredEmail, index) => {
    const originalPosition = originalEmails[index].position;
    
    // Try to find a valid reference point
    let referenceNode = null;
    
    if (originalPosition.previousSibling && 
        originalPosition.previousSibling.parentNode === originalParent) {
      referenceNode = originalPosition.previousSibling.nextSibling;
    }
    else if (originalPosition.nextSibling && 
             originalPosition.nextSibling.parentNode === originalParent) {
      referenceNode = originalPosition.nextSibling;
    }
    
    if (referenceNode) {
      originalParent.insertBefore(restoredEmail, referenceNode);
    } else {
      originalParent.appendChild(restoredEmail);
    }
    
    // Re-initialize Gmail's event handlers
    restoredEmail.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  });
  
  // Remove from storage
  chrome.storage.local.remove(folderId);
  
  // Remove from folderActions
  folderActions.delete(folderId);
  
  // Re-add quick actions to restored emails
  setTimeout(addQuickActions, 0);
}

// Helper function to safely access chrome storage
function safeStorageSet(data) {
    try {
        if (chrome?.storage?.local) {
            chrome.storage.local.set(data);
        } else {
            // Fallback to localStorage if chrome.storage isn't available
            Object.entries(data).forEach(([key, value]) => {
                localStorage.setItem(key, JSON.stringify(value));
            });
        }
    } catch (error) {
        console.warn('Storage error:', error);
    }
}

// Helper function to safely access stored data
function safeStorageGet(key, callback) {
    try {
        if (chrome?.storage?.local) {
            chrome.storage.local.get(key, callback);
        } else {
            // Fallback to localStorage
            const data = localStorage.getItem(key);
            callback(data ? { [key]: JSON.parse(data) } : {});
        }
    } catch (error) {
        console.warn('Storage error:', error);
        callback({});
    }
}

// Update the storeFolderData function
function storeFolderData(folderId, folderData) {
    console.log('Storing folder data:', { folderId, folderData });
    const data = {
        senderDisplay: folderData.senderDisplay,
        emails: folderData.emails.map(email => ({
            id: email.getAttribute('data-legacy-thread-id'), // Gmail's thread ID
            data: Array.from(email.cells).map(cell => ({
                className: cell.className,
                innerHTML: cell.innerHTML
            }))
        })),
        state: folderData.state || 'expanded',
        timestamp: Date.now()
    };
    
    safeStorageSet({ [folderId]: data });
}

// Update the restoreStoredFolders function
function restoreStoredFolders() {
    console.log('Restoring folders...');
    safeStorageGet(null, (items) => {
        console.log('Retrieved stored items:', items);
        Object.entries(items).forEach(([key, data]) => {
            if (key.startsWith('folder-')) {
                const existingEmails = data.emails
                    .map(email => document.querySelector(`[data-legacy-thread-id="${email.id}"]`))
                    .filter(Boolean);
                
                if (existingEmails.length > 1) {
                    createFolder(data.senderDisplay, existingEmails, data.state);
                } else {
                    // Clean up storage
                    safeStorageSet({ [key]: null });
                }
            }
        });
    });
}

function cleanupStoredFolders() {
  chrome.storage.local.get(null, (items) => {
    const now = Date.now();
    Object.entries(items).forEach(([key, data]) => {
      if (key.startsWith('folder-')) {
        // Remove folders older than 1 day
        if (now - data.timestamp > ONE_DAY) {
          chrome.storage.local.remove(key);
        }
      }
    });
  });
}

// Call cleanup periodically
setInterval(cleanupStoredFolders, ONE_DAY);