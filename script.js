document.addEventListener('DOMContentLoaded', () => {
    // === HTML要素の取得 ===
    const startDateInput = document.getElementById('start-date-input');
    const fileInput = document.getElementById('file-input');
    const encodingSelector = document.getElementById('encoding-selector');
    const classSelector = document.getElementById('class-selector');
    const studentChecklistContainer = document.getElementById('student-checklist-container');
    const colsInput = document.getElementById('cols');
    const rowsInput = document.getElementById('rows');
    const editLayoutButton = document.getElementById('edit-layout-button');
    const saveLayoutButton = document.getElementById('save-layout-button');
    const shuffleButton = document.getElementById('shuffle-button');
    const seatMap = document.getElementById('seat-map');
    const exportCsvButton = document.getElementById('export-csv');
    const exportPdfButton = document.getElementById('export-pdf');
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultWrapper = document.querySelector('.result-wrapper');
    const clearDataButton = document.getElementById('clear-data-button');

    // === グローバル変数 ===
    let masterStudentList = [];
    let allLayoutData = {};
    let currentSeatData = [];
    let isLayoutEditing = false;
    let inactiveSeatIndexes = new Set();

    // ==========================================================
    // 初期化処理
    // ==========================================================
    function initialize() {
        // デフォルトで今日の日付を設定
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        startDateInput.value = `${year}-${month}-${day}`;
        
        const savedStudents = localStorage.getItem('sekigaeMasterList');
        if (savedStudents) {
            masterStudentList = JSON.parse(savedStudents);
            if (masterStudentList.length > 0) populateClassSelector();
        }
        const savedLayouts = localStorage.getItem('sekigaeAllLayoutData');
        if (savedLayouts) {
            allLayoutData = JSON.parse(savedLayouts);
        }
    }
    
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    // ★ 修正点：createSeatMap関数内の文字数チェックを「6文字以上」のみに修正 ★
    // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
    function createSeatMap(members) {
        seatMap.innerHTML = '';
        const cols = parseInt(colsInput.value, 10);
        const rows = parseInt(rowsInput.value, 10);
        seatMap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        let memberIndex = 0;

        for (let i = 0; i < cols * rows; i++) {
            const seat = document.createElement('div');
            seat.classList.add('seat');
            seat.dataset.index = i;

            if (inactiveSeatIndexes.has(i)) {
                seat.classList.add('inactive');
            } else {
                const member = (memberIndex < members.length) ? members[memberIndex] : null;
                if (member) {
                    // ★修正箇所：6文字以上の場合のみクラスを割り当てる
                    let longNameClass = '';
                    if (member.name.length >= 6) {
                        longNameClass = 'long-name-6';
                    }
                    
                    seat.innerHTML = `<span class="seat-id">${member.id}</span><span class="seat-name ${longNameClass}">${member.name}</span>`;
                    
                    const gender = member.gender.toLowerCase();
                    if (gender.includes('男')) seat.classList.add('male');
                    else if (gender.includes('女')) seat.classList.add('female');
                    memberIndex++;
                } else {
                    seat.textContent = '空席';
                    seat.classList.add('empty');
                }
            }
            seatMap.appendChild(seat);
        }
        updateCurrentSeatData();
    }


    // (これ以降の関数は変更ありません)
    function updateCurrentSeatData() {
        const cols = parseInt(colsInput.value, 10);
        const allSeats = Array.from(seatMap.querySelectorAll('.seat'));
        currentSeatData = [];
        let rowData = [];

        allSeats.forEach((seat, i) => {
            let cellContent = '使用不可';
            if (!seat.classList.contains('inactive')) {
                if (seat.classList.contains('empty')) {
                    cellContent = '空席';
                } else {
                    const id = seat.querySelector('.seat-id').textContent;
                    const name = seat.querySelector('.seat-name').textContent;
                    const gender = seat.classList.contains('male') ? '男' : (seat.classList.contains('female') ? '女' : '不明');
                    cellContent = `${id},${name},${gender}`;
                }
            }
            rowData.push(cellContent);

            if ((i + 1) % cols === 0) {
                currentSeatData.push(rowData);
                rowData = [];
            }
        });
        if (rowData.length > 0) currentSeatData.push(rowData);
    }

    function populateClassSelector() {
        const classNames = new Set(masterStudentList.map(s => `${s.id.substring(0, 1)}-${s.id.substring(1, 2)}`));
        classSelector.innerHTML = '<option value="">クラスを選択...</option>';
        Array.from(classNames).sort().forEach(className => {
            const option = document.createElement('option');
            option.value = className;
            option.textContent = className;
            classSelector.appendChild(option);
        });
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const selectedEncoding = encodingSelector.value;
        const reader = new FileReader();

        reader.onload = (e) => {
            const fileContent = e.target.result;
            const { validMembers, invalidRows } = parseMemberList(fileContent);

            masterStudentList = validMembers;
            
            if (masterStudentList.length > 0) {
                localStorage.setItem('sekigaeMasterList', JSON.stringify(masterStudentList));
                populateClassSelector();
                studentChecklistContainer.innerHTML = '';
                
                let alertMessage = `${masterStudentList.length}件のデータを正常に読み込みました。クラスを選択してください。`;
                if (invalidRows.length > 0) {
                    alertMessage += `\n\n警告: ${invalidRows.length}行のデータ形式が正しくないため、無視されました。\n（例: ${invalidRows[0].lineNumber}行目）\nCSVファイルをご確認ください。`;
                }
                alert(alertMessage);
                
            } else {
                alert('有効なデータを1件も読み込めませんでした。\nCSVファイルの形式（番号,氏名,性別）と文字コードを確認してください。');
            }
        };

        reader.readAsText(file, selectedEncoding);
        event.target.value = '';
    });

    classSelector.addEventListener('change', () => {
        studentChecklistContainer.innerHTML = '';
        seatMap.innerHTML = '';
        const selectedClass = classSelector.value;
        if (!selectedClass) return;

        loadLayout(selectedClass);
        previewEmptySeatMap(); 

        const classMembers = masterStudentList.filter(s => `${s.id.substring(0, 1)}-${s.id.substring(1, 2)}` === selectedClass);
        classMembers.sort((a, b) => a.id.localeCompare(b.id)).forEach(member => {
            const div = document.createElement('div');
            div.className = 'student-checklist-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `student-${member.id}`;
            checkbox.value = member.id;
            const label = document.createElement('label');
            label.htmlFor = `student-${member.id}`;
            label.textContent = `${member.id} ${member.name}`;
            div.appendChild(checkbox);
            div.appendChild(label);
            studentChecklistContainer.appendChild(div);
        });
    });

    function loadLayout(className) {
        const layout = allLayoutData[className];
        if (layout) {
            colsInput.value = layout.cols;
            rowsInput.value = layout.rows;
            inactiveSeatIndexes = new Set(layout.inactive);
        } else {
            colsInput.value = 6;
            rowsInput.value = 6;
            inactiveSeatIndexes.clear();
        }
    }

    function previewEmptySeatMap() {
        seatMap.innerHTML = '';
        const cols = parseInt(colsInput.value, 10);
        const rows = parseInt(rowsInput.value, 10);
        seatMap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        for (let i = 0; i < cols * rows; i++) {
            const seat = document.createElement('div');
            seat.classList.add('seat');
            seat.dataset.index = i;
            if (inactiveSeatIndexes.has(i)) {
                seat.classList.add('inactive');
            }
            seatMap.appendChild(seat);
        }
    }
    
    colsInput.addEventListener('change', previewEmptySeatMap);
    rowsInput.addEventListener('change', previewEmptySeatMap);

    editLayoutButton.addEventListener('click', () => {
        isLayoutEditing = !isLayoutEditing;
        if (isLayoutEditing) {
            resultWrapper.classList.add('layout-editing');
            editLayoutButton.classList.add('editing');
            editLayoutButton.textContent = '編集を終了';
            if (seatMap.innerHTML === '') previewEmptySeatMap();
        } else {
            resultWrapper.classList.remove('layout-editing');
            editLayoutButton.classList.remove('editing');
            editLayoutButton.textContent = 'レイアウト編集を開始';
        }
    });

    seatMap.addEventListener('click', (e) => {
        if (!isLayoutEditing) return;
        const seat = e.target.closest('.seat');
        if (!seat) return;
        const index = parseInt(seat.dataset.index, 10);
        seat.classList.toggle('inactive');
        if (inactiveSeatIndexes.has(index)) {
            inactiveSeatIndexes.delete(index);
        } else {
            inactiveSeatIndexes.add(index);
        }
    });

    saveLayoutButton.addEventListener('click', () => {
        const selectedClass = classSelector.value;
        if (!selectedClass) {
            alert('レイアウトを保存するクラスを選択してください。');
            return;
        }
        allLayoutData[selectedClass] = {
            cols: parseInt(colsInput.value, 10),
            rows: parseInt(rowsInput.value, 10),
            inactive: Array.from(inactiveSeatIndexes)
        };
        localStorage.setItem('sekigaeAllLayoutData', JSON.stringify(allLayoutData));
        alert(`「${selectedClass}」のカスタムレイアウトを保存しました。`);
    });
    
    shuffleButton.addEventListener('click', () => {
        const selectedClass = classSelector.value;
        if (!selectedClass) { alert('席替えをするクラスを選択してください。'); return; }

        const absentStudentIds = Array.from(studentChecklistContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        let attendees = masterStudentList.filter(s => `${s.id.substring(0, 1)}-${s.id.substring(1, 2)}` === selectedClass && !absentStudentIds.includes(s.id));

        const activeSeatCount = (colsInput.value * rowsInput.value) - inactiveSeatIndexes.size;
        if (attendees.length > activeSeatCount) {
            alert(`生徒の人数（${attendees.length}人）が座れる席の数（${activeSeatCount}席）を超えています。`);
            return;
        }
        
        shuffleButton.disabled = true;
        shuffleButton.textContent = 'シャッフル中...';
        if (isLayoutEditing) editLayoutButton.click();
        
        const seats = Array.from(seatMap.querySelectorAll('.seat:not(.inactive)'));
        seats.forEach(seat => seat.classList.add('flipping'));

        for (let i = attendees.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [attendees[i], attendees[j]] = [attendees[j], attendees[i]];
        }
        
        setTimeout(() => {
            createSeatMap(attendees);
        }, 300);

        setTimeout(() => {
            shuffleButton.disabled = false;
            shuffleButton.textContent = '席替えスタート！';
        }, 1500);
    });
    
    function parseMemberList(text) {
        const lines = text.split(/\r\n|\n/);
        const validMembers = [];
        const invalidRows = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') return;

            const parts = trimmedLine.split(',').map(part => part.trim());
            
            if (parts.length === 3 && parts[0].match(/^\d{4}$/) && parts[1]) {
                validMembers.push({ id: parts[0], name: parts[1], gender: parts[2] });
            } else {
                invalidRows.push({ lineNumber: index + 1, content: line });
            }
        });

        return { validMembers, invalidRows };
    }

    exportCsvButton.addEventListener('click', () => {
        if (currentSeatData.length === 0) { alert('席替えを先に実行してください。'); return; }
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        currentSeatData.forEach(rowArray => { csvContent += rowArray.join(",") + "\r\n"; });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "sekigae_result.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    });

    exportPdfButton.addEventListener('click', async () => {
        if (currentSeatData.length === 0) { alert('席替えを先に実行してください。'); return; }
        loadingOverlay.style.display = 'flex';
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const dateValue = startDateInput.value;
        const className = classSelector.options[classSelector.selectedIndex].text;
        try {
            const canvas1 = await html2canvas(resultWrapper, { scale: 2 });
            const imgData1 = canvas1.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth1 = pdfWidth - 20;
            const imgHeight1 = (canvas1.height * imgWidth1) / canvas1.width;
            pdf.setFontSize(16);
            pdf.text(`${className} 座席表`, pdfWidth / 2, 15, { align: 'center' });
            pdf.setFontSize(11);
            pdf.text(`適用日: ${dateValue}`, pdfWidth - 10, 15, { align: 'right' });
            pdf.text('生徒側からの視点', 10, 22);
            pdf.addImage(imgData1, 'PNG', 10, 25, imgWidth1, imgHeight1 > pdfHeight - 35 ? pdfHeight - 35 : imgHeight1);
            pdf.addPage();
            resultWrapper.classList.add('rotate-180');
            const canvas2 = await html2canvas(resultWrapper, { scale: 2 });
            const imgData2 = canvas2.toDataURL('image/png');
            const imgWidth2 = pdfWidth - 20;
            const imgHeight2 = (canvas2.height * imgWidth2) / canvas2.width;
            pdf.setFontSize(16);
            pdf.text(`${className} 座席表`, pdfWidth / 2, 15, { align: 'center' });
            pdf.setFontSize(11);
            pdf.text(`適用日: ${dateValue}`, pdfWidth - 10, 15, { align: 'right' });
            pdf.text('教員側から見た座席表', 10, 22);
            pdf.addImage(imgData2, 'PNG', 10, 25, imgWidth2, imgHeight2 > pdfHeight - 35 ? pdfHeight - 35 : imgHeight2);
            pdf.save(`sekigae_result_${className}_${dateValue}.pdf`);
        } catch (error) {
            console.error("PDF生成中にエラーが発生しました:", error);
            alert("PDFの生成に失敗しました。");
        } finally {
            resultWrapper.classList.remove('rotate-180');
            loadingOverlay.style.display = 'none';
        }
    });

    clearDataButton.addEventListener('click', () => {
        if (confirm('ブラウザに保存されている全てのクラス名簿とカスタムレイアウトを削除します。この操作は元に戻せません。よろしいですか？')) {
            localStorage.removeItem('sekigaeMasterList');
            localStorage.removeItem('sekigaeAllLayoutData');
            location.reload();
        }
    });
    
    initialize();
});