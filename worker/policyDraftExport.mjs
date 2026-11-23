import { Packer } from 'docx';
import { wordDocument } from '../src/lib/documentExport.js';
import { fromDraft } from '../shared/documentWorkspace.mjs';
export async function savePolicyDraft(env,actor,job,item,branding={}) {
 const id=`policy-${job.id}-${item.id}`;
 const exists=await env.DB.prepare('SELECT document_id FROM documents WHERE company_id=? AND document_id=?').bind(actor.company_id,id).first();if(exists)return id;
 const empty={type:'doc',content:[]};const body=fromDraft(item.sections.map(section=>`**${section.heading}**\n${section.text}`).join('\n\n'));
 const content={mode:'custom',header:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:job.profile.legal_name}]}]},body:{type:'doc',content:[{type:'heading',attrs:{level:1},content:[{type:'text',text:item.title}]},...body.content]},footer:empty,branding:{...branding,company_name:job.profile.legal_name,company_address:job.profile.registered_address}};
 const bytes=await Packer.toBuffer(wordDocument(content,true));const type='application/vnd.openxmlformats-officedocument.wordprocessingml.document';const key=`companies/${actor.company_id}/documents/${id}`;
 if(!env.HRMS_DOCUMENTS)throw Object.assign(Error('Document storage is unavailable.'),{status:503});
 await env.HRMS_DOCUMENTS.put(key,bytes,{httpMetadata:{contentType:type}});
 const metadata={file_name:'company-policy-draft.docx',format:'DOCX',category:item.category,description:`Proposed company policy - ${item.purpose}. Created by Aster; HR approval required.`,version:'Draft',draft:true,review_status:'draft',origin:'ai',verified:false,editor_content:content,generation_job:job.id,generation_item:item.id,applicable_departments:job.departments||[],delivery:'uploaded'};
 await env.DB.prepare('INSERT INTO documents(document_id,company_id,employee_id,title,object_key,content_type,size_bytes,uploaded_by,metadata) VALUES(?,?,NULL,?,?,?,?,?,?) ON CONFLICT(document_id) DO NOTHING').bind(id,actor.company_id,item.title,key,type,bytes.length,actor.user_id,JSON.stringify(metadata)).run();
 return id;
}
