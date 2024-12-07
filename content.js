// 等待页面加载完成
document.addEventListener('DOMContentLoaded', () => {
    initializeExtension();
  });
  
  function initializeExtension() {
    // 添加初始化按钮
    const headerRight = document.querySelector('.gb_Qd');
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
      `;
      toggleButton.onclick = organizeEmails;
      headerRight.prepend(toggleButton);
    }
  }
  
  function organizeEmails() {
    // 选择所有邮件行
    const emailRows = document.querySelectorAll('tr.zA');
    
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
    
    // 添加折叠/展开功能
    folderHeader.addEventListener('click', () => {
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