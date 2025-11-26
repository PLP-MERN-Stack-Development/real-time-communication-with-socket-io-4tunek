import React from 'react';

export default function OnlineList({ users }) {
return (
<div className="online-list">
<h4>Online ({users?.length ?? 0})</h4>
<ul>
{users?.map((u) => (
<li key={u}>{u}</li>
))}
</ul>
</div>
);
}