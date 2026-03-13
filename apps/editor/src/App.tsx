import './App.css'
import { Toolbar } from './components/Toolbar'
import { LayersPanel } from './components/LayersPanel'
import { Canvas } from './components/Canvas'
import { PropertiesPanel } from './components/PropertiesPanel'

function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#e5e5e5]">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LayersPanel />
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  )
}

export default App

