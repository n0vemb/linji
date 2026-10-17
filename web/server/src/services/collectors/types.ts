/** 采集器共用类型 */
import type { MediaType } from '../../../../src/data/types';

export interface PlatformFindings {
  /** 平台接口真实拿到的标题 */
  title?: string;
  /** 作者 */
  author?: string;
  /** 正文（抖音 desc / 小红书 note.desc） */
  copy?: string;
  /** 从正文里识别的话题 */
  tags?: string[];
  /** 远程图片 URL 列表（编排层负责下载转存） */
  images?: string[];
  /** 远程视频 URL（转存失败则降级） */
  videoUrl?: string | null;
  /** 素材类型 */
  mediaType?: MediaType;
  /** 短链展开后的最终 URL（内容 ID 已更新时同步） */
  finalUrl?: string;
  /** 封面图远程 URL（编排层下载转存） */
  coverRemoteUrl?: string;
  /** 封面图本地 URL（采集器已自行下载转存时） */
  coverLocalUrl?: string;
  /** 这次抓取实际拿到了什么（生成给用户的 note 用） */
  fetched: string[];
  /** 受限 / 失败原因（如实告知，不伪造） */
  limitation?: string;
}
