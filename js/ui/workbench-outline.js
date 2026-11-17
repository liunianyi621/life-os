const outlineClosedProjects=new Set(),outlineOpenGroups=new Set(),outlineOpenContents=new Set();
let outlineEditor=null,outlineDrag=null;
function renderOutlineAtScroll(top=window.scrollY){render();window.scrollTo({top,behavior:'instant'});}
function outlineAttrs(kind,id,projectId='',groupId=''){return `data-outline-edit-kind="${kind}" data-id="${escapeAttr(id)}" data-project-id="${escapeAttr(projectId)}" data-group-id="${escapeAttr(groupId)}"`;}
function outlineHandle(kind,id,projectId='',groupId=''){return `<button type="button" class="outline-handle" data-outline-handle="${kind}" data-id="${escapeAttr(id)}" data-project-id="${escapeAttr(projectId)}" data-group-id="${escapeAttr(groupId)}" aria-label="拖动排序" title="拖动排序，方向键调整顺序">≡</button>`;}
function outlineEditorHtml(kind,id){
  const e=outlineEditor;if(!e||e.kind!==kind||e.id!==id)return '';
  return `<form class="outline-editor" data-outline-form><label class="sr-only" for="outlineText">${kind==='note'?'备注':'名称'}</label>${kind==='note'?`<textarea id="outlineText" name="text" rows="3">${escapeHtml(e.text)}</textarea>`:`<input id="outlineText" name="text" value="${escapeAttr(e.text)}" required autocomplete="off" enterkeyhint="done">`}${kind==='task'?`<label class="outline-date">截止日期<input name="dueDate" type="date" value="${escapeAttr(e.dueDate||'')}"></label>`:''}<div class="outline-editor-actions"><button type="submit">保存</button><button type="button" data-outline-cancel>取消</button>${id?'<button type="button" data-outline-delete>删除</button>':''}</div><p data-outline-error role="alert" hidden></p></form>`;
}
function renderWorkbenchOutline(){
  const host=document.getElementById('workbenchList');if(!host)return;
  const focus=document.activeElement?.closest('.outline-editor')?{name:document.activeElement.name,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;
  const data=workbenchData();
  host.innerHTML=(outlineEditor?.kind==='project'&&!outlineEditor.id?outlineEditorHtml('project',null):'')+data.projects.filter(p=>p.status!=='deleted').map(p=>{
    const closed=outlineClosedProjects.has(p.id),groups=wbProjectGroups(p.id);
    return `<section class="outline-project" data-outline-row="project" data-id="${escapeAttr(p.id)}"><div class="outline-project-heading">${outlineEditor?.kind==='project'&&outlineEditor.id===p.id?outlineEditorHtml('project',p.id):`<button type="button" class="outline-label" data-outline-project="${escapeAttr(p.id)}" ${outlineAttrs('project',p.id,p.id)} aria-expanded="${!closed}"><span class="outline-arrow" aria-hidden="true">${closed?'›':'⌄'}</span><strong>${escapeHtml(p.name)}</strong></button>${outlineHandle('project',p.id)}`}</div>${closed?'':`<div class="outline-categories">${groups.map(g=>{
      const open=outlineOpenGroups.has(g.id);
      return `<section data-outline-row="group" data-id="${escapeAttr(g.id)}" data-project-id="${escapeAttr(p.id)}"><div class="outline-category-heading">${outlineEditor?.kind==='group'&&outlineEditor.id===g.id?outlineEditorHtml('group',g.id):`<button type="button" class="outline-label" data-outline-group="${escapeAttr(g.id)}" ${outlineAttrs('group',g.id,p.id)} aria-expanded="${open}"><span class="outline-arrow" aria-hidden="true">${open?'⌄':'›'}</span><span>${escapeHtml(g.name)}</span></button>${outlineHandle('group',g.id,p.id)}`}</div>${open?`<div class="outline-contents">${wbOutlineContents(p.id,g.id).map(({kind,item})=>{
        if(outlineEditor?.kind===kind&&outlineEditor.id===item.id)return `<div data-outline-row="content" data-id="${escapeAttr(item.id)}">${outlineEditorHtml(kind,item.id)}</div>`;
        const done=kind==='task'&&wbEffectiveStatus(item)==='completed',expanded=outlineOpenContents.has(item.id);
        return `<div class="outline-content ${done?'is-complete':''}" data-outline-row="content" data-id="${escapeAttr(item.id)}" data-project-id="${escapeAttr(p.id)}" data-group-id="${escapeAttr(g.id)}">${kind==='task'?`<button type="button" class="habit-complete-control" data-outline-complete="${escapeAttr(item.id)}" aria-label="${done?'取消完成':'完成'}">${done?actionIcons['checkmark.circle']:'<span class="habit-empty-circle" aria-hidden="true"></span>'}</button>`:''}<button type="button" class="outline-content-text ${kind==='note'?'is-note':''} ${expanded?'is-expanded':''}" data-outline-content="${escapeAttr(item.id)}" ${outlineAttrs(kind,item.id,p.id,g.id)}>${escapeHtml(kind==='note'?item.text:wbTaskName(item))}</button>${outlineHandle('content',item.id,p.id,g.id)}${expanded&&kind==='task'?`<div class="outline-task-extras">${item.dueDate?`<small>${escapeHtml(item.dueDate)}</small>`:''}<button type="button" data-wb-today="${escapeAttr(item.id)}">加入今天</button>${wbTodayExecution(item)&&!dailyTaskSettled(wbTodayExecution(item))?`<button type="button" data-wb-cancel="${escapeAttr(item.id)}">取消今日安排</button>`:''}</div>`:''}</div>`;
      }).join('')}${outlineEditor&&!outlineEditor.id&&outlineEditor.projectId===p.id&&outlineEditor.groupId===g.id?outlineEditorHtml(outlineEditor.kind,null):`<div class="outline-add-content"><button type="button" data-outline-add="task" data-project-id="${escapeAttr(p.id)}" data-group-id="${escapeAttr(g.id)}">＋ 待办</button><button type="button" data-outline-add="note" data-project-id="${escapeAttr(p.id)}" data-group-id="${escapeAttr(g.id)}">＋ 备注</button></div>`}</div>`:''}</section>`;
    }).join('')}${outlineEditor?.kind==='group'&&!outlineEditor.id&&outlineEditor.projectId===p.id?outlineEditorHtml('group',null):`<button type="button" class="outline-add-category" data-outline-new-group="${escapeAttr(p.id)}">＋ 新增分类</button>`}</div>`}</section>`;
  }).join('');
  const unassigned=data.tasks.filter(t=>!t.projectId&&t.status!=='deleted');if(unassigned.length)host.insertAdjacentHTML('beforeend',`<button class="outline-add-category" type="button" data-wb-assign>为 ${unassigned.length} 项旧任务选择项目</button>`);
  if(focus){const input=host.querySelector(`[name="${focus.name}"]`);if(input){input.focus({preventScroll:true});if(input.type!=='date')input.setSelectionRange(focus.start,focus.end);}}
}
function startOutlineEdit(kind,id=null,projectId=null,groupId=null){
  if(outlineEditor){document.querySelector('.outline-editor input,.outline-editor textarea')?.focus();return;}
  const data=workbenchData(),item=kind==='project'?data.projects.find(p=>p.id===id):kind==='group'?wbProjectGroups(projectId).find(g=>g.id===id):kind==='task'?wbTask(id):(data.notes||[]).find(n=>n.id===id);
  if(id&&!item)return;
  outlineEditor={kind,id,projectId,groupId,text:item?(kind==='note'?item.text:kind==='task'?wbTaskName(item):item.name):'',dueDate:item?.dueDate||''};
  if(projectId)outlineClosedProjects.delete(projectId);if(groupId)outlineOpenGroups.add(groupId);
  renderWorkbenchOutline();const input=document.getElementById('outlineText');input?.focus();input?.scrollIntoView({block:'nearest'});
}
function outlineError(error){const node=document.querySelector('[data-outline-error]');if(node){node.hidden=false;node.textContent=error.message;}else showToast(error.message);}
document.addEventListener('input',event=>{if(!outlineEditor||!event.target.closest('.outline-editor'))return;if(event.target.name==='text')outlineEditor.text=event.target.value;if(event.target.name==='dueDate')outlineEditor.dueDate=event.target.value;});
document.addEventListener('submit',event=>{
  if(!event.target.matches('[data-outline-form]'))return;event.preventDefault();const e=outlineEditor;if(!e)return;
  const values=new FormData(event.target);e.text=String(values.get('text')||'');if(e.kind==='task')e.dueDate=String(values.get('dueDate')||'');
  try{
    if(e.kind==='project')saveOutlineProject({id:e.id,name:e.text});
    else if(e.kind==='group')saveWorkbenchGroup(e.projectId,{id:e.id,name:e.text});
    else if(e.kind==='note')saveWorkbenchNote({...e,text:e.text});
    else {const task=e.id&&wbTask(e.id);saveWorkbenchTask({...task,id:e.id,name:e.text,projectId:e.projectId,groupId:e.groupId,dueDate:e.dueDate||null,status:task?wbEffectiveStatus(task):'todo'});}
    const scroll=window.scrollY;outlineEditor=null;document.activeElement?.blur();renderOutlineAtScroll(scroll);syncSheetViewport();
  }catch(error){outlineError(error);}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  try{
    if(b.hasAttribute('data-outline-new-project'))startOutlineEdit('project');
    else if(b.dataset.outlineNewGroup)startOutlineEdit('group',null,b.dataset.outlineNewGroup);
    else if(b.dataset.outlineAdd)startOutlineEdit(b.dataset.outlineAdd,null,b.dataset.projectId,b.dataset.groupId);
    else if(b.hasAttribute('data-outline-cancel')){const scroll=window.scrollY;outlineEditor=null;document.activeElement?.blur();renderOutlineAtScroll(scroll);syncSheetViewport();}
    else if(b.dataset.outlineProject){if(outlineEditor)return;const id=b.dataset.outlineProject;outlineClosedProjects.has(id)?outlineClosedProjects.delete(id):outlineClosedProjects.add(id);renderWorkbenchOutline();}
    else if(b.dataset.outlineGroup){if(outlineEditor)return;const id=b.dataset.outlineGroup;outlineOpenGroups.has(id)?outlineOpenGroups.delete(id):outlineOpenGroups.add(id);renderWorkbenchOutline();}
    else if(b.dataset.outlineContent){const id=b.dataset.outlineContent;outlineOpenContents.has(id)?outlineOpenContents.delete(id):outlineOpenContents.add(id);renderWorkbenchOutline();}
    else if(b.dataset.outlineComplete){const t=wbTask(b.dataset.outlineComplete);if(!t)return;if(wbEffectiveStatus(t)==='completed'){
      if(pendingUndo&&((pendingUndo.type==='workbench_completed'&&pendingUndo.taskId===t.id)||(pendingUndo.type==='daily_task_completed'&&t.executionIds.includes(pendingUndo.taskId))))undoLastAction();
      else saveWorkbenchTask({...t,name:wbTaskName(t),status:'todo'});
    }else completeWorkbenchTask(t.id);render();}
    else if(b.hasAttribute('data-outline-delete')){const e=outlineEditor;if(!e?.id)return;
      const data=workbenchData(),tasks=data.tasks.filter(t=>t.status!=='deleted'&&(e.kind==='project'?t.projectId===e.id:e.kind==='group'?t.projectId===e.projectId&&wbTaskGroupId(t)===e.id:e.kind==='task'&&t.id===e.id)),notes=(data.notes||[]).filter(n=>n.status==='active'&&(e.kind==='project'?n.projectId===e.id:e.kind==='group'?n.projectId===e.projectId&&n.groupId===e.id:e.kind==='note'&&n.id===e.id));
      const groups=e.kind==='project'?wbProjectGroups(e.id).length:0;
      if(await askForConfirmation({title:'删除此内容？',message:`将移除${groups?groups+' 个分类、':''}${tasks.length} 项待办和 ${notes.length} 条备注（包含已完成内容）。未结算的今日安排会取消，历史金币流水保留。`,confirmText:'确认删除'})){deleteWorkbenchOutline(e.kind,e.id,e.projectId);outlineEditor=null;render();}
    }
  }catch(error){outlineError(error);}
});
function outlineDragRows(d){return [...document.querySelectorAll(`[data-outline-row="${d.kind}"]`)].filter(n=>d.kind==='project'||(n.dataset.projectId===d.projectId&&(d.kind==='group'||n.dataset.groupId===d.groupId)));}
function finishOutlineDrag(commit){
  const d=outlineDrag;if(!d)return;outlineDrag=null;document.body.classList.remove('outline-dragging');
  document.querySelectorAll('.outline-drag-source,.outline-drop-target').forEach(n=>n.classList.remove('outline-drag-source','outline-drop-target'));
  if(commit&&d.target&&d.target!==d.id)try{reorderWorkbenchOutline(d.kind,d.id,d.target,d.projectId,d.groupId);renderWorkbenchOutline();}catch(error){outlineError(error);}
}
document.addEventListener('pointerdown',event=>{const h=event.target.closest('[data-outline-handle]');if(!h||outlineEditor||event.button!==0)return;event.preventDefault();outlineDrag={kind:h.dataset.outlineHandle,id:h.dataset.id,projectId:h.dataset.projectId,groupId:h.dataset.groupId,pointer:event.pointerId,handle:h};h.setPointerCapture(event.pointerId);document.body.classList.add('outline-dragging');h.closest('[data-outline-row]').classList.add('outline-drag-source');});
document.addEventListener('pointermove',event=>{const d=outlineDrag;if(!d||d.pointer!==event.pointerId)return;event.preventDefault();const rows=outlineDragRows(d),target=rows.reduce((best,n)=>{const r=n.getBoundingClientRect(),distance=Math.abs(event.clientY-r.top-Math.min(r.height,60)/2);return !best||distance<best.distance?{n,distance}:best;},null);document.querySelectorAll('.outline-drop-target').forEach(n=>n.classList.remove('outline-drop-target'));if(target){d.target=target.n.dataset.id;if(d.target!==d.id)target.n.classList.add('outline-drop-target');}const height=window.visualViewport?.height||innerHeight;if(event.clientY>height-90)window.scrollBy(0,12);else if(event.clientY<70)window.scrollBy(0,-12);},{passive:false});
document.addEventListener('pointerup',()=>finishOutlineDrag(true));document.addEventListener('pointercancel',()=>finishOutlineDrag(false));window.addEventListener('pagehide',()=>finishOutlineDrag(false));
document.addEventListener('keydown',event=>{const h=event.target.closest('[data-outline-handle]');if(!h||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const d={kind:h.dataset.outlineHandle,id:h.dataset.id,projectId:h.dataset.projectId,groupId:h.dataset.groupId},rows=outlineDragRows(d),i=rows.findIndex(n=>n.dataset.id===d.id),target=rows[i+(event.key==='ArrowUp'?-1:1)];if(target)try{reorderWorkbenchOutline(d.kind,d.id,target.dataset.id,d.projectId,d.groupId);renderWorkbenchOutline();document.querySelector(`[data-outline-handle="${d.kind}"][data-id="${d.id}"]`)?.focus();}catch(error){outlineError(error);}});
