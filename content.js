// Add this at the top of the file
let isButtonAdded = false;

// 等待页面加载完成
function waitForGmailToLoad() {
  console.log('Waiting for Gmail to load...');
  
  const observer = new MutationObserver((mutations, obs) => {
    if (isButtonAdded) {
      obs.disconnect();
      return;
    }

    // Single initialization attempt
    initializeExtension();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Replace the existing event listener with:
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForGmailToLoad);
} else {
  waitForGmailToLoad();
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
  
  // 创建一个 Map 来存储按发件人分组的邮件
  const emailsBySender = new Map();
  
  emailRows.forEach(row => {
    const senderElement = row.querySelector('.yP, .zF'); // Gmail 的发件人类名
    if (senderElement) {
      const sender = senderElement.getAttribute('email') || senderElement.getAttribute('name');
      
      if (!emailsBySender.has(sender)) {
        emailsBySender.set(sender, []);
      }
      emailsBySender.get(sender).push(row);
    }
  });
  
  // 为有多封邮件的发件人创建文件夹
  emailsBySender.forEach((emails, sender) => {
    if (emails.length > 1) {
      createFolder(sender, emails);
    }
  });
}
  
function createFolder(sender, emails) {
  // 创建文件夹容器
  const folderContainer = document.createElement('div');
  folderContainer.className = 'email-folder';
  
  // 创建文件夹头部
  const folderHeader = document.createElement('div');
  folderHeader.className = 'folder-header';
  folderHeader.innerHTML = `
    <span class="folder-toggle">▼</span>
    <span class="folder-sender">${sender}</span>
    <span class="email-count">${emails.length} 封邮件</span>
  `;
  
  // 创建文件夹内容区
  const folderContent = document.createElement('div');
  folderContent.className = 'folder-content';
  
  // 添加邮件到文件夹
  emails.forEach(email => {
    folderContent.appendChild(email.cloneNode(true));
    email.remove(); // 移除原始邮件行
  });
  
  // Add state persistence
  const folderId = `folder-${sender.replace(/[^a-zA-Z0-9]/g, '')}`;
  folderContainer.id = folderId;
  
  // Load saved state
  chrome.storage.local.get(folderId, (result) => {
    const isCollapsed = result[folderId] === 'collapsed';
    folderContent.style.display = isCollapsed ? 'none' : 'block';
    folderHeader.querySelector('.folder-toggle').textContent = isCollapsed ? '▶' : '▼';
  });
  
  // Save state on toggle
  folderHeader.addEventListener('click', () => {
    const newState = folderContent.style.display === 'none' ? 'expanded' : 'collapsed';
    chrome.storage.local.set({ [folderId]: newState });
    folderContent.style.display = 
      folderContent.style.display === 'none' ? 'block' : 'none';
    folderHeader.querySelector('.folder-toggle').textContent = 
      folderContent.style.display === 'none' ? '▶' : '▼';
  });
  
  // 组装文件夹
  folderContainer.appendChild(folderHeader);
  folderContainer.appendChild(folderContent);
  
  // 将文件夹插入到收件箱
  const inboxContainer = document.querySelector('.AO');
  if (inboxContainer) {
    inboxContainer.insertBefore(folderContainer, inboxContainer.firstChild);
  }
}