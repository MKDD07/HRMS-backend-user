import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, Focus, Mail, Phone } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { departmentTheme } from '../../lib/departmentTheme';
import './OrganizationPersonNode.scss';
export const OrganizationPersonNode = React.memo(function OrganizationPersonNode({data,selected}) {
 const person=data.person;
 const name=person.name || [person.first_name,person.last_name].filter(Boolean).join(' ') || person.userid || person.id;
 return <article className={'organization-person-node'+(selected||data.focused?' is-selected':'')+(data.temporary?' is-indirect':'')+(data.teamRole?' has-team-role':'')+(data.onLeave?' is-on-leave':'')} style={data.departmentStyle || departmentTheme(person.department || 'General')}>
  {!data.temporary&&<Handle id="top" type="target" position={Position.Top}/>}
  {data.sideConnections&&<><Handle id="left" type="target" position={Position.Left}/><Handle id="right" type="source" position={Position.Right}/></>}
  <div className="organization-person-node__heading"><span>{person.department || 'Department not assigned'}</span>{data.remove&&<Button className="nodrag" size="sm" variant="fadeout" icon={X} iconOnly aria-label={data.removeLabel || ('Remove '+name+' from chart')} title={data.removeLabel || ('Remove '+name+' from chart')} onClick={()=>data.remove(person.id)}/>}</div>
  <div className="organization-person-node__identity"><Avatar size="md" name={name} src={person.profile_pic_url}/><div><strong>{name}</strong><small>{person.designation || 'Team member'}</small>{data.teamRole && <span className="organization-person-node__role">{data.teamRole}</span>}</div></div>
  {(person.email || person.phone_number || person.phone)&&<div className="organization-person-node__contact">{person.email&&<span title={person.email}><Mail size={11}/>{person.email}</span>}{(person.phone_number||person.phone)&&<span><Phone size={11}/>{person.phone_number||person.phone}</span>}</div>}
  <div className="organization-person-node__footer"><span>{data.onLeave ? 'On leave' : data.temporary?'Indirect member':person.employee_code || person.userid || person.id}</span>{data.setFocus&&<Button className="nodrag" size="sm" variant="fadeout" icon={Focus} onClick={()=>data.setFocus(person.id)}>Focus</Button>}</div>
  {!data.temporary&&<Handle id="bottom" type="source" position={Position.Bottom}/>}
 </article>;
});
