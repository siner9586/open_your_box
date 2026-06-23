#!/usr/bin/env python3
"""Safe Shodan lookup wrapper for Open Your Box.

Reads SHODAN_API_KEY from the environment. If the key or shodan package is not
available, returns a deterministic demo response. This script does not print raw
banners, default passwords, exploit hints, or sensitive service URLs.
"""
import argparse, json, os, sys, datetime

def mask_ip(ip: str) -> str:
    parts = ip.split('.')
    return '.'.join(parts[:3] + ['*']) if len(parts) == 4 else ip

def demo(ip: str):
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return [{
        "sourceTool": "Shodan",
        "evidenceType": "public_service_exposure_demo",
        "title": "公网服务暴露检查（Demo）",
        "description": "未检测到本地 SHODAN_API_KEY 或 shodan 包，已返回演示数据。",
        "maskedValue": mask_ip(ip),
        "confidence": 0.72,
        "riskLevel": "medium",
        "port": 443,
        "service": "https",
        "product": "demo-web",
        "version": "masked",
        "organization": "Example Demo Network",
        "country": "ZZ",
        "lastSeen": now,
        "remediation": ["确认资产归属", "收敛管理入口", "开启 MFA 与访问控制", "复查证书与过期服务"]
    }]

def main():
    parser = argparse.ArgumentParser(description="Open Your Box safe Shodan lookup")
    parser.add_argument('--ip', required=True, help='Owned or authorized IP address')
    parser.add_argument('--out', default='', help='Output JSON path')
    parser.add_argument('--authorized', action='store_true', help='Confirm that the target is owned or explicitly authorized')
    args = parser.parse_args()
    api_key = os.getenv('SHODAN_API_KEY')
    if not args.authorized and api_key:
        print('Authorization required for real Shodan lookup. Add --authorized only for owned or explicitly authorized assets.', file=sys.stderr)
        sys.exit(2)
    results = demo(args.ip)
    if api_key:
        try:
            import shodan  # type: ignore
            api = shodan.Shodan(api_key)
            host = api.host(args.ip)
            safe_items = []
            for item in host.get('data', []):
                ssl = item.get('ssl') or {}
                cert = ssl.get('cert') or {}
                safe_items.append({
                    "sourceTool": "Shodan",
                    "evidenceType": "public_service_exposure",
                    "title": f"公网服务：{item.get('port', 'unknown')}",
                    "description": "Shodan 返回的授权资产服务摘要，已移除原始 banner 与敏感字段。",
                    "maskedValue": mask_ip(args.ip),
                    "confidence": 0.86,
                    "riskLevel": "high" if item.get('port') in [22, 3389, 5900, 6379, 9200] else "medium",
                    "port": item.get('port'),
                    "service": item.get('_shodan', {}).get('module') or item.get('transport'),
                    "product": item.get('product', 'masked'),
                    "version": item.get('version', 'masked'),
                    "organization": host.get('org') or host.get('isp') or 'masked',
                    "country": host.get('country_code', 'masked'),
                    "sslCertificate": {"issuer": cert.get('issuer', {}).get('CN', 'masked'), "subject": cert.get('subject', {}).get('CN', 'masked')},
                    "lastSeen": item.get('timestamp'),
                    "remediation": ["确认服务是否必须公网开放", "将管理入口迁移到 VPN/零信任", "限制来源 IP", "升级过期组件", "定期复查 Shodan/Censys 暴露面"]
                })
            results = safe_items or demo(args.ip)
        except Exception as exc:
            results = demo(args.ip)
            results[0]['description'] += f" 本地真实查询失败，原因已概括为：{type(exc).__name__}。"
    payload = json.dumps(results, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f: f.write(payload)
    else:
        print(payload)
if __name__ == '__main__':
    main()
