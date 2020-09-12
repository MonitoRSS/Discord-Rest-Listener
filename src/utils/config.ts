import fs from 'fs'
import path from 'path'
import { ConfigSchema, ConfigType } from '../schemas/ConfigSchema'
const configPath = path.join(__dirname, '..', '..', 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ConfigType

ConfigSchema.parse(config)

export default config
