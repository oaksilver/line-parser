let parsedData = null;
let allMessages = [];
let debugMode = false;

// Language Support 
const translations = {
    id: {
        welcome: "Backup dan analisis chat LINE Anda sebelum terlambat",
        uploadTitle: "Upload File Chat LINE",
        uploadDesc: "Mendukung format .txt dan .csv dari ekspor chat LINE",
        previewTitle: "Preview Chat:",
        statsTotal: "Total Pesan",
        statsParticipants: "Peserta Chat",
        statsPeriod: "Periode",
        statsActive: "Paling Aktif",
        btnJSON: "💾 Download JSON",
        btnHTML: "📄 Download HTML",
        btnStats: "📊 Statistik Detail",
        btnSearch: "🔍 Cari Pesan",
        infoText: `<strong>Cara ekspor chat dari LINE:</strong><br>
1. Buka chat yang ingin di-backup<br>
2. Tap menu (⋮) di pojok kanan atas<br>
3. Pilih "Pengaturan Chat" → "Ekspor Riwayat Chat"<br>
4. Pilih format dan periode waktu<br>
5. Upload file hasil ekspor di sini`
    },
    en: {
        welcome: "Backup and analyze your LINE chat before it's too late",
        uploadTitle: "Upload LINE Chat File",
        uploadDesc: "Supports .txt and .csv format exported from LINE",
        previewTitle: "Chat Preview:",
        statsTotal: "Total Messages",
        statsParticipants: "Participants",
        statsPeriod: "Period",
        statsActive: "Most Active",
        btnJSON: "💾 Download JSON",
        btnHTML: "📄 Download HTML",
        btnStats: "📊 Detailed Statistics",
        btnSearch: "🔍 Search Messages",
        infoText: `<strong>How to export chat from LINE:</strong><br>
1. Open the chat you want to back up<br>
2. Tap the menu (⋮) in the top right corner<br>
3. Select "Chat Settings" → "Export Chat History"<br>
4. Choose format and time period<br>
5. Upload the exported file here`
    }
};

function setLanguage(lang) {
    document.getElementById('welcomeText').textContent = translations[lang].welcome;
    const uploadTitle = document.querySelector('.upload-section h3');
    if (uploadTitle) uploadTitle.textContent = translations[lang].uploadTitle;
    const uploadDesc = document.querySelector('.upload-section p');
    if (uploadDesc) uploadDesc.textContent = translations[lang].uploadDesc;
    const previewTitle = document.querySelector('#chatPreview h4');
    if (previewTitle) previewTitle.textContent = translations[lang].previewTitle;
    const statLabels = document.querySelectorAll('.stat-label');
    if (statLabels.length === 4) {
        statLabels[0].textContent = translations[lang].statsTotal;
        statLabels[1].textContent = translations[lang].statsParticipants;
        statLabels[2].textContent = translations[lang].statsPeriod;
        statLabels[3].textContent = translations[lang].statsActive;
    }
    const btns = document.querySelectorAll('.controls .btn');
    if (btns.length === 4) {
        btns[0].textContent = translations[lang].btnJSON;
        btns[1].textContent = translations[lang].btnHTML;
        btns[2].textContent = translations[lang].btnStats;
        btns[3].textContent = translations[lang].btnSearch;
    }
    const infoText = document.getElementById('infoText');
    if (infoText) infoText.innerHTML = translations[lang].infoText;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeParser();
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.addEventListener('change', function(e) {
            setLanguage(e.target.value);
        });
    }
    setLanguage('id'); // Default
});

function initializeParser() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    debugLog('LINE Chat Parser initialized');
}

function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0) {
        alert('Tidak ada file yang dipilih!');
        return;
    }

    debugLog(`Selected ${files.length} file(s)`);
    
    const fileLabel = document.getElementById('fileLabel');
    fileLabel.textContent = '⏳ Memproses...';
    
    allMessages = [];
    let processedFiles = 0;
    const totalFiles = files.length;

    Array.from(files).forEach((file, index) => {
        debugLog(`Processing file ${index + 1}: ${file.name} (${file.size} bytes)`);
        
        const reader = new FileReader();
        
        reader.onerror = function() {
            const errorMsg = `Error membaca file: ${file.name}`;
            alert(errorMsg);
            debugLog(errorMsg, 'error');
            fileLabel.textContent = '📂 Pilih File Chat';
        };
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                debugLog(`File content preview (${file.name}):`, content.substring(0, 200) + '...');
                
                const messages = parseLineChat(content, file.name);
                debugLog(`Successfully parsed ${messages.length} messages from ${file.name}`);
                
                allMessages.push(...messages);
                
                processedFiles++;
                if (processedFiles === totalFiles) {
                    fileLabel.textContent = '📂 Pilih File Chat';
                    
                    if (allMessages.length === 0) {
                        const errorMsg = 'Tidak ada pesan yang berhasil diparse. Cek format file atau aktifkan Debug Mode untuk detail.';
                        alert(errorMsg);
                        debugLog(errorMsg, 'error');
                        return;
                    }
                    
                    allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    displayResults();
                }
            } catch (error) {
                const errorMsg = `Error parsing file ${file.name}: ${error.message}`;
                console.error('Parse error:', error);
                alert(errorMsg);
                debugLog(errorMsg, 'error');
                fileLabel.textContent = '📂 Pilih File Chat';
            }
        };
        
        reader.readAsText(file, 'UTF-8');
    });
}

function parseLineChat(content, filename) {
    const messages = [];
    const lines = content.split('\n');
    debugLog(`Parsing ${lines.length} lines from ${filename}`);
    debugLog('First 5 lines of file:', lines.slice(0, 5));
    const patterns = [
        { name: 'Bracket Format', regex: /^\[(.+?)\]\s*(.+?):\s*(.+)$/, example: '[2024/01/15 10:30] User: Message' },
        { name: 'Tab Separated', regex: /^(.+?)\t(.+?)\t(.+)$/, example: '2024/01/15 10:30\tUser\tMessage' },
        { name: 'Comma Separated', regex: /^(.+?),\s*(.+?):\s*(.+)$/, example: '2024/01/15 10:30, User: Message' },
        { name: 'Standard Format', regex: /^(\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?):\s*(.+)$/, example: '2024/01/15 10:30 User: Message' },
        { name: 'Simple Format', regex: /^(.+?):\s*(.+)$/, example: 'User: Message' }
    ];
    const dateLineRegex = /^(?:\w{3},\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    let currentDate = null;
    let parsedCount = 0;
    let patternStats = {};
    patterns.forEach(p => patternStats[p.name] = 0);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.includes('Saved on') || line.includes('Chat history') || line.includes('Riwayat chat') || (line.includes('LINE') && line.includes('chat'))) {
            debugLog(`Skipping header line ${i + 1}: ${line}`);
            continue;
        }
        let dateMatch = line.match(/^\w{3},\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!dateMatch) dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
            const [_, month, day, year] = dateMatch;
            currentDate = { year: parseInt(year), month: parseInt(month), day: parseInt(day) };
            debugLog(`Detected date line: ${year}-${month}-${day}`);
            continue;
        }
        let tabMsgMatch = line.match(/^(\d{1,2}):(\d{2})\t(.+?)\t(.+)$/);
        if (tabMsgMatch && currentDate) {
            const hour = parseInt(tabMsgMatch[1]);
            const minute = parseInt(tabMsgMatch[2]);
            const sender = tabMsgMatch[3].trim();
            const message = tabMsgMatch[4].trim();
            const timestamp = new Date(currentDate.year, currentDate.month - 1, currentDate.day, hour, minute);
            const now = new Date();

            if (timestamp.getFullYear() < 2000 || timestamp.getFullYear() > now.getFullYear() + 1) continue;

            const systemKeywords = ['line', 'bergabung', 'meninggalkan', 'mengundang', 'joined', 'left', 'invited'];
            const isSystemMessage = systemKeywords.some(keyword => sender.toLowerCase().includes(keyword) || message.toLowerCase().includes(keyword));
            if (isSystemMessage) continue;
            messages.push({
                timestamp: timestamp,
                sender: sender,
                message: message,
                source: filename,
                lineNumber: i + 1,
                pattern: 'Tab+DateLine'
            });
            parsedCount++;
            if (parsedCount <= 3) debugLog(`Parse success #${parsedCount}: ${sender} -> ${message.substring(0, 50)}...`);
            continue;
        }
        let match = null;
        let patternUsed = null;
        for (const pattern of patterns) {
            match = line.match(pattern.regex);
            if (match) {
                patternUsed = pattern;
                patternStats[pattern.name]++;
                break;
            }
        }
        if (match && patternUsed) {
            let timestamp, sender, message;
            if (patternUsed.name === 'Simple Format') {
                continue;
            } else if (match.length >= 4) {
                timestamp = parseTimestamp(match[1]);
                if (!timestamp) continue;
                sender = match[2].trim();
                message = match[3].trim();
            } else {
                continue;
            }
            const systemKeywords = ['line', 'bergabung', 'meninggalkan', 'mengundang', 'joined', 'left', 'invited'];
            const isSystemMessage = systemKeywords.some(keyword => sender.toLowerCase().includes(keyword) || message.toLowerCase().includes(keyword));
            if (isSystemMessage) continue;
            messages.push({
                timestamp: timestamp,
                sender: sender,
                message: message,
                source: filename,
                lineNumber: i + 1,
                pattern: patternUsed.name
            });
            parsedCount++;
            if (parsedCount <= 3) debugLog(`Parse success #${parsedCount}: ${sender} -> ${message.substring(0, 50)}...`);
        } else if (line.length > 10) {
            debugLog(`Could not parse line ${i + 1}: ${line.substring(0, 100)}...`);
        }
    }
    debugLog(`Parse complete: ${parsedCount} messages from ${lines.length} lines`);
    debugLog('Pattern usage:', patternStats);
    return messages;
}

function parseTimestamp(timestampStr) {
    debugLog(`Parsing timestamp: ${timestampStr}`);
    
    const formats = [
        /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
        /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/,
        /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
    ];

    for (const format of formats) {
        const match = timestampStr.match(format);
        if (match) {
            let year, month, day, hour, minute, second;
            
            if (format === formats[0] || format === formats[2]) {
                [, year, month, day, hour, minute, second] = match;
            } else {
                [, month, day, year, hour, minute, second] = match;
            }
            
            const date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second) || 0
            );
            
            const now = new Date();
            if (date.getFullYear() < 2000 || date.getFullYear() > now.getFullYear() + 1) {
                debugLog(`Timestamp out of range: ${date}`);
                return null;
            }
            debugLog(`Parsed timestamp result: ${date}`);
            return date;
        }
    }


    const fallbackDate = new Date(timestampStr);
    const now = new Date();
    if (!isNaN(fallbackDate) && fallbackDate.getFullYear() >= 2000 && fallbackDate.getFullYear() <= now.getFullYear() + 1) {
        debugLog(`Fallback timestamp result: ${fallbackDate}`);
        return fallbackDate;
    }
    debugLog(`Failed to parse timestamp: ${timestampStr}`);
    return null;
}

function displayResults() {
    if (allMessages.length === 0) {
        debugLog('No messages to display', 'error');
        return;
    }

    debugLog(`Displaying results for ${allMessages.length} messages`);

    const participants = [...new Set(allMessages.map(msg => msg.sender))];
    const messageCount = {};
    participants.forEach(p => messageCount[p] = 0);
    allMessages.forEach(msg => messageCount[msg.sender]++);
    
    const mostActive = Object.keys(messageCount).reduce((a, b) => 
        messageCount[a] > messageCount[b] ? a : b
    );

    const firstMsg = allMessages[0];
    const lastMsg = allMessages[allMessages.length - 1];
    const dateRange = `${firstMsg.timestamp.toLocaleDateString()} - ${lastMsg.timestamp.toLocaleDateString()}`;

    document.getElementById('totalMessages').textContent = allMessages.length.toLocaleString();
    document.getElementById('totalParticipants').textContent = participants.length;
    document.getElementById('dateRange').textContent = dateRange;
    document.getElementById('mostActive').textContent = mostActive;


    document.getElementById('stats').style.display = 'grid';
    document.getElementById('controls').style.display = 'flex';

    displayPreview();
    
    debugLog('Results displayed successfully');
}

function displayPreview(messages = null) {
    const container = document.getElementById('messagesContainer');
    const preview = document.getElementById('chatPreview');
    const msgsToShow = messages || allMessages.slice(-20);
    debugLog(`Displaying ${msgsToShow.length} messages in preview`);
    container.innerHTML = '';
    // Deteksi dua user paling aktif
    const userCount = {};
    allMessages.forEach(msg => { userCount[msg.sender] = (userCount[msg.sender] || 0) + 1; });
    const sortedUsers = Object.keys(userCount).sort((a, b) => userCount[b] - userCount[a]);
    const user1 = sortedUsers[0] || '';
    const user2 = sortedUsers[1] || '';
    msgsToShow.forEach(msg => {
        let bubbleClass = '';
        if (msg.sender === user1) bubbleClass = 'bubble-green';
        else if (msg.sender === user2) bubbleClass = 'bubble-white';
        else bubbleClass = 'bubble-other';
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + bubbleClass;
        messageDiv.innerHTML = `
            <div class="message-header">
                ${escapeHtml(msg.sender)} • ${msg.timestamp.toLocaleString()}
            </div>
            <div class="message-content">${escapeHtml(msg.message)}</div>
        `;
        container.appendChild(messageDiv);
    });
    preview.style.display = 'block';
}

function downloadJSON() {
    debugLog('Downloading JSON backup');
    
    const data = {
        exportInfo: {
            exportDate: new Date().toISOString(),
            totalMessages: allMessages.length,
            participants: [...new Set(allMessages.map(msg => msg.sender))],
            dateRange: {
                start: allMessages[0].timestamp,
                end: allMessages[allMessages.length - 1].timestamp
            }
        },
        messages: allMessages
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `line_chat_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadHTML() {
    debugLog('Downloading HTML backup');
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>LINE Chat Backup</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .chat-container { max-width: 800px; margin: 0 auto; }
        .message { background: white; padding: 10px 15px; margin-bottom: 5px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .sender { font-weight: bold; color: #00c300; }
        .timestamp { font-size: 0.8em; color: #666; }
        .content { margin-top: 5px; }
        h1 { text-align: center; color: #00c300; }
    </style>
</head>
<body>
    <div class="chat-container">
        <h1>📱 LINE Chat Backup</h1>
        <p>Total pesan: ${allMessages.length} | Periode: ${allMessages[0].timestamp.toLocaleDateString()} - ${allMessages[allMessages.length-1].timestamp.toLocaleDateString()}</p>
`;

    allMessages.forEach(msg => {
        html += `
        <div class="message">
            <span class="sender">${escapeHtml(msg.sender)}</span>
            <span class="timestamp">${msg.timestamp.toLocaleString()}</span>
            <div class="content">${escapeHtml(msg.message)}</div>
        </div>
`;
    });

    html += `
    </div>
</body>
</html>
`;

    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `line_chat_backup_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showStats() {
    debugLog('Showing detailed statistics');
    
    const participants = [...new Set(allMessages.map(msg => msg.sender))];
    const messageCount = {};
    const hourlyActivity = new Array(24).fill(0);
    const dailyActivity = {};

    participants.forEach(p => messageCount[p] = 0);
    
    allMessages.forEach(msg => {
        messageCount[msg.sender]++;
        hourlyActivity[msg.timestamp.getHours()]++;
        const date = msg.timestamp.toDateString();
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    let statsText = `📊 STATISTIK DETAIL CHAT\n\n`;
    statsText += `📈 Pesan per Pengguna:\n`;
    Object.entries(messageCount)
        .sort(([,a], [,b]) => b - a)
        .forEach(([user, count]) => {
            const percentage = ((count / allMessages.length) * 100).toFixed(1);
            statsText += `• ${user}: ${count} pesan (${percentage}%)\n`;
        });

    statsText += `\n🕐 Aktivitas per Jam:\n`;
    hourlyActivity.forEach((count, hour) => {
        if (count > 0) {
            statsText += `• ${hour.toString().padStart(2, '0')}:00 - ${count} pesan\n`;
        }
    });

    alert(statsText);
}

function searchMessages() {
    const query = prompt('Masukkan kata kunci untuk dicari:');
    if (!query) return;

    debugLog(`Searching for: ${query}`);

    const results = allMessages.filter(msg => 
        msg.message.toLowerCase().includes(query.toLowerCase()) ||
        msg.sender.toLowerCase().includes(query.toLowerCase())
    );

    debugLog(`Found ${results.length} matching messages`);

    if (results.length === 0) {
        alert('Tidak ada pesan yang ditemukan.');
        return;
    }

    displayPreview(results.slice(-50)); 
    alert(`Ditemukan ${results.length} pesan yang cocok dengan "${query}"`);
}

function toggleDebug() {
    debugMode = !debugMode;
    const debugInfo = document.getElementById('debugInfo');
    
    if (debugMode) {
        debugInfo.style.display = 'block';
        debugLog('Debug mode enabled');
    } else {
        debugInfo.style.display = 'none';
    }
}

function debugLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (type === 'error') {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }
    
    if (debugMode) {
        const debugContent = document.getElementById('debugContent');
        if (debugContent) {
            const logDiv = document.createElement('div');
            logDiv.style.color = type === 'error' ? 'red' : 'black';
            logDiv.style.marginBottom = '5px';
            logDiv.textContent = typeof message === 'object' ? JSON.stringify(message, null, 2) : logMessage;
            debugContent.appendChild(logDiv);
            debugContent.scrollTop = debugContent.scrollHeight;
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}