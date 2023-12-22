// 修改exe文件信息
// https://convertio.co/zh/png-ico/
import * as PELibrary from 'pe-library';
import * as ResEdit from 'resedit';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import pac from './package.json' assert { type: 'json' };
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { version, description, name, author } = pac;

if (!existsSync(join(__dirname, './dist-pkg/gitea-pages-win.exe'))) {
  process.exit();
}

// 加载和解析数据
const data = readFileSync(join(__dirname, './dist-pkg/gitea-pages-win.exe'));

//（Node.js Buffer实例可以直接指定给NtExecutable.from）
const exe = PELibrary.NtExecutable.from(data);
const res = PELibrary.NtExecutableResource.from(exe);

//重写资源
//-您可以使用以下帮助程序类：
//-ResEdit.Resource.IconGroupEntry:访问图标资源数据
//-ResEdit.Resource.StringTable:访问字符串资源数据
//-ResEdit.Resource.VersionInfo:访问版本信息数据

//--替换图标
//从文件加载图标数据

//（可以使用ResEdit.Data.IconFile解析图标数据）
const iconFile = ResEdit.Data.IconFile.from(readFileSync(join(__dirname, './gitea.ico')));

ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  // 目标条目
  res.entries,
  // 图标组ID
  // - 此ID最初在基本可执行文件中定义
  // (ID列表可以通过`ResEdit.Resource.IconGroupEntry.fromEntries(res.entries).map((entry)=>entry.id)`获取)
  1,
  // (修改会报错)  语言(‘lang：1033’的意思是‘en-US’)
  1033,
  // 图标(将IconFileItem映射到IconItem/RawIconItem)
  iconFile.icons.map(item => item.data)
);

// -- 替换版本

const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const vi = viList[0];

const versionList = version.split('.');
// 修改文件版本号
vi.setFileVersion(Number(versionList[0]), Number(versionList[1]), Number(versionList[2] ?? '0'));

// 删除自带的lang
for (const item of vi.getAvailableLanguages()) {
  vi.removeAllStringValues(item, true);
}

// 修改文件信息  (‘lang：0x0804’的意思是‘zh-CN’, 'codepage: 1200' 设置默认代码页) https://learn.microsoft.com/zh-cn/openspecs/windows_protocols/ms-lcid/a9eac961-e77d-41a6-90a5-ce1a8b0cdb9c?redirectedfrom=MSDN
vi.setStringValues(
  { lang: 0x0804, codepage: 1200 },
  {
    // 产品描述
    FileDescription: description,
    // 产品名称
    ProductName: name,
    // 公司名称
    CompanyName: author,
    // 版权信息
    LegalCopyright: `Copyright © ${new Date().getFullYear()} ${author}`,
    // 产品版本
    ProductVersion: version,
    // 原始文件名
    OriginalFilename: name + '.exe'
  }
);
vi.outputToResourceEntries(res.entries);

// 写入另一个二进制
res.outputResource(exe);
const newBinary = exe.generate();
writeFileSync(join(__dirname, './dist-pkg/gitea-pages-win.exe'), Buffer.from(newBinary));
