import React,{useEffect,useState} from 'react';
import { File,FileImage,FileText,Download,Eye } from 'lucide-react';
import { TenantPanel } from '../../components/ui/TenantPanel';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ImageWithSkeleton } from '../../components/ui/ImageWithSkeleton';
import { mailApi } from '../../lib/mailApi';

function fileType(name=''){
  const extension=name.split('.').pop().toLowerCase();
  const images={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',bmp:'image/bmp'};
  return images[extension]?{kind:'image',mime:images[extension],label:'Image',Icon:FileImage}:extension==='pdf'?{kind:'pdf',mime:'application/pdf',label:'PDF document',Icon:FileText}:extension==='docx'?{kind:'word',label:'Word document',Icon:FileText}:extension==='doc'?{kind:'legacy-word',label:'Word document',Icon:FileText}:{kind:'file',label:extension?extension.toUpperCase()+' file':'File',Icon:File};
}
function saveFile(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function AttachmentCard({item,context,onView}){
  const type=fileType(item.filename),Icon=type.Icon;
  const [thumbnail,setThumbnail]=useState(''),[failed,setFailed]=useState(false),[downloading,setDownloading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(type.kind!=='image')return;
    const controller=new AbortController();let url;
    mailApi.attachment({...context,index:item.index},controller.signal).then(blob=>{if(controller.signal.aborted)return;url=URL.createObjectURL(new Blob([blob],{type:type.mime}));setThumbnail(url);}).catch(error=>{if(error.name!=='AbortError')setFailed(true);});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[context.folder,context.uid,item.index,item.filename]);
  async function download(){setDownloading(true);setError('');try{saveFile(await mailApi.attachment({...context,index:item.index}),item.filename);}catch(e){setError(e.message);}finally{setDownloading(false);}}
  return <TenantPanel className="mail-attachment-card" headingLevel={3} title={item.filename} subtitle={`${type.label} · ${Math.max(1,Math.ceil(item.size/1024))} KB`} icon={Icon}>
    <button type="button" className="mail-attachment-visual" aria-label={`View ${item.filename}`} onClick={()=>onView(item)}>{type.kind==='image'&&!failed?<ImageWithSkeleton src={thumbnail} loading={!thumbnail} alt={item.filename} width="100%" height={112} shape="rounded" fit="cover" onError={()=>setFailed(true)}/>:<span className={`mail-file-mark mail-file-mark--${type.kind}`}><Icon size={38} aria-hidden="true"/><strong>{type.kind==='pdf'?'PDF':type.kind==='word'||type.kind==='legacy-word'?'DOC':type.kind==='image'?'IMAGE':'FILE'}</strong></span>}</button>
    {error&&<p className="mail-attachment-error" role="alert">{error}</p>}
    <footer className="tenant-panel-footer"><Button variant="outline" size="sm" icon={Eye} onClick={()=>onView(item)}>View</Button><Button variant="fadeout" size="sm" icon={Download} loading={downloading} onClick={download}>Download</Button></footer>
  </TenantPanel>;
}

function AttachmentPreview({item,context,onClose}){
  const type=fileType(item.filename),Icon=type.Icon;
  const [blob,setBlob]=useState(null),[url,setUrl]=useState(''),[html,setHtml]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let objectUrl;
    (async()=>{try{
      const file=await mailApi.attachment({...context,index:item.index},controller.signal);
      if(controller.signal.aborted)return;
      setBlob(file);
      if(type.kind==='word'){
        const [{default:mammoth},{default:purify}]=await Promise.all([import('mammoth/mammoth.browser.js'),import('dompurify')]);
        const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()},{externalFileAccess:false});
        if(!controller.signal.aborted)setHtml(purify.sanitize(result.value,{USE_PROFILES:{html:true},FORBID_TAGS:['img','a','iframe','object','embed','script','style','form','input','button'],FORBID_ATTR:['style']}));
      }else if(type.kind==='image'||type.kind==='pdf'){
        objectUrl=URL.createObjectURL(new Blob([file],{type:type.mime}));setUrl(objectUrl);
      }
    }catch(e){if(e.name!=='AbortError')setError(e.message);}finally{if(!controller.signal.aborted)setLoading(false);}})();
    return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[context.folder,context.uid,item.index,item.filename]);
  return <Modal isOpen title={item.filename} subtitle={`${type.label} · ${Math.max(1,Math.ceil(item.size/1024))} KB`} size={type.kind==='image'?'md':'lg'} className={`mail-file-preview mail-file-preview--${type.kind}`} onClose={onClose} footer={<Button variant="colored" icon={Download} disabled={!blob||loading} onClick={()=>saveFile(blob,item.filename)}>Download</Button>}>
    {error?<p className="ws-error" role="alert">{error}</p>:loading?<div className={`mail-preview-skeleton mail-preview-skeleton--${type.kind}`} role="status" aria-label="Loading attachment" aria-busy="true">{type.kind==='image'?<div className="skeleton mail-preview-image-placeholder"/>:<div className="mail-preview-paper-placeholder">{[0,1,2,3,4].map(i=><div key={i} className="skeleton skeleton--text"/>)}</div>}</div>:type.kind==='image'?<div className="mail-image-preview"><ImageWithSkeleton src={url} alt={item.filename} width="100%" height="100%" fit="contain"/></div>:type.kind==='pdf'?<iframe className="mail-pdf-preview" src={url} title={item.filename}/>:type.kind==='word'?<article className="mail-word-preview" dangerouslySetInnerHTML={{__html:html}}/>:<div className="mail-preview-unavailable"><Icon size={48} aria-hidden="true"/><p>{type.kind==='legacy-word'?'Preview is unavailable for older .doc files. Download to open in Word.':'Download this file to open it in its original application.'}</p></div>}
  </Modal>;
}

export function MailAttachments({items,folder,uid,validity}){
  const [preview,setPreview]=useState(null);
  const context={folder,uid,validity};
  if(!items?.length)return null;
  return <section className="mail-attachment-section" aria-label="Attachments"><h3>Attachments <span>{items.length}</span></h3><div className="workspace-grid mail-attachment-cards">{items.map(item=><AttachmentCard key={`${uid}:${item.index}`} item={item} context={context} onView={setPreview}/>)}</div>{preview&&<AttachmentPreview key={`${uid}:${preview.index}`} item={preview} context={context} onClose={()=>setPreview(null)}/>}</section>;
}
