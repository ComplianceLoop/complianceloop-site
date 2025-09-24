import Image from "next/image";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card from "../../components/ui/Card";

export const metadata = { title: "Design Playground • ComplianceLoop" };

export default function Playground(){
  return (
    <main className="container">
      <h1 style={{fontFamily:"var(--font-heading)", marginBottom:"12px"}}>Design Playground</h1>
      <p style={{opacity:.8, marginBottom:24}}>Tweak colors in <code>apps/portal/theme.ts</code>, replace <code>apps/portal/public/brand/logo.svg</code> or <code>hero.jpg</code>, and refresh.</p>

      <Card>
        <div className="row" style={{alignItems:"center"}}>
          <Image src="/brand/logo.svg" alt="Logo" width={160} height={40}/>
          <Image src="/brand/hero.jpg" alt="Hero" width={320} height={120} style={{borderRadius:12, objectFit:"cover"}}/>
        </div>
      </Card>

      <div className="row" style={{marginTop:24}}>
        <Card><h3>Buttons</h3><div className="row">
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div></Card>
        <Card><h3>Inputs</h3>
          <div style={{display:"grid", gap:12}}>
            <Input placeholder="Email"/>
            <Input placeholder="Company"/>
            <Input placeholder="Address"/>
          </div>
        </Card>
      </div>

      <div className="row" style={{marginTop:24}}>
        <Card style={{flex:1}}>
          <h3>Colors</h3>
          <div className="row">
            {["primary","primaryHover","accent","bg","surface","text","muted","success","warning","danger"].map(k=>(
              <div key={k} style={{textAlign:"center"}}>
                <div className="swatch" style={{background:`var(--color-${k})`}}/>
                <div style={{fontSize:12,opacity:.8,marginTop:6}}>{k}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{flex:1}}>
          <h3>Sample Section</h3>
          <p>Use this area to preview headings, body text, cards and lists.</p>
          <ul>
            <li>Single-column forms with labels above inputs</li>
            <li>Inline validation and friendly microcopy</li>
            <li>Accessible focus rings and large tap targets</li>
          </ul>
          <Button style={{marginTop:8}}>Call to action</Button>
        </Card>
      </div>
    </main>
  );
}
