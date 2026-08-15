const { EmbedBuilder } = require('discord.js');

const roadmapsData = {
    Web: {
        book: {
            "title": "🕸️ Web Exploitation – Book-then-Apply Roadmap",
            "color": 0x6952ea,
            "description": "Theory first → Practice second. Best for people who like understanding *why* before hacking.",
            "fields": [
                {
                    "name": "Step 1 – Foundation (Days 1–7)",
                    "value": "• Read **Web Hacking 101** or **Bug Bounty Bootcamp** (Vickie Li)\n• Install Burp Suite Community + browser\n• Learn: HTTP, cookies, headers, source code"
                },
                {
                    "name": "Step 2 – Core Practice (Weeks 2–5)",
                    "value": "• [PortSwigger Web Security Academy](https://portswigger.net/web-security) (complete Server-side + Client-side paths)\n• OverTheWire **Natas**\n• PicoCTF Web challenges\n• Hacker101 CTF"
                },
                {
                    "name": "Step 3 – Intermediate",
                    "value": "• Free TryHackMe Web rooms\n• Root-Me Web challenges\n• Focus: SQLi → XSS → SSRF → SSTI → Deserialization"
                },
                {
                    "name": "Example Daily Task",
                    "value": "1. Read 1 chapter or PortSwigger topic\n2. Solve 2–3 related labs\n3. Write 3–5 key notes or payloads in your cheat sheet"
                }
            ],
            "footer": { "text": "Underdogs Pack • Consistency > Intensity" }
        },
        visual: {
            "title": "🕸️ Web Exploitation – Visual Learner Roadmap",
            "color": 0x6952ea,
            "description": "Watch → Immediately practice. Perfect for people who learn by seeing.",
            "fields": [
                {
                    "name": "Core Video Sources",
                    "value": "• PortSwigger Academy videos\n• CryptoCat Web CTF walkthroughs\n• John Hammond & LiveOverflow Web series\n• Sam Bowne lectures"
                },
                {
                    "name": "Practice Loop",
                    "value": "1. Watch 1–2 short videos on one vulnerability\n2. Solve 3–5 matching labs on:\n   - PortSwigger Academy\n   - PicoCTF Web\n   - Natas\n   - Free TryHackMe rooms\n3. Review community writeups"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Watch 1 video (15–25 min) → Solve 3 related labs → Add payloads to your personal cheat sheet"
                }
            ],
            "footer": { "text": "Underdogs Pack • Watch → Hack → Repeat" }
        }
    },
    Cryptography: {
        book:
        {
            "title": "🔑 Cryptography – Book-then-Apply Roadmap",
            "color": 0x342066,
            "description": "Build strong fundamentals before diving into CTF crypto.",
            "fields": [
                {
                    "name": "Step 1 – Theory",
                    "value": "• *Serious Cryptography* (Aumasson) or *Understanding Cryptography* (Paar)\n• Free alternative: CrypTool book + number theory basics"
                },
                {
                    "name": "Step 2 – Practice",
                    "value": "• PicoCTF Crypto\n• Root-Me Crypto\n• CyberChef daily practice\n• Free TryHackMe crypto rooms\n• Tools: Python + pycryptodome, RsaCtfTool, SageMath"
                },
                {
                    "name": "Progression",
                    "value": "Encoding/Hashes → Classical Ciphers → RSA & Padding Oracles → Modern implementation flaws"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Read 1 concept → Solve 3 PicoCTF/Root-Me crypto challenges → Document the technique"
                }
            ]
        },
        visual:
        {
            "title": "🔑 Cryptography – Visual Learner Roadmap",
            "color": 0x342066,
            "fields": [
                {
                    "name": "Video Sources",
                    "value": "• CryptoCat Crypto walkthroughs\n• LiveOverflow Crypto series\n• John Hammond / Gynvael solves\n• pwn.college Cryptography lectures"
                },
                {
                    "name": "Practice Loop",
                    "value": "Watch technique → Immediately solve matching PicoCTF / Root-Me / CyberChef challenge"
                },
                {
                    "name": "Example Daily Task",
                    "value": "1 video (20 min) + 3–4 crypto challenges + update your notes"
                }
            ]
        }
    },
    Forensics: {
        book:
        {
            "title": "🔍 Forensics – Book-then-Apply Roadmap",
            "color": 0x7d638f,
            "fields": [
                {
                    "name": "Core Book",
                    "value": "*Practical Malware Analysis* (Sikorski & Honig) + Wireshark/Volatility docs"
                },
                {
                    "name": "Practice Platforms",
                    "value": "• PicoCTF Forensics\n• Free TryHackMe Forensics/SOC rooms\n• Root-Me Forensics\n• VulnHub disk images\n• Public PCAPs & memory dumps"
                },
                {
                    "name": "Tool Progression",
                    "value": "file / binwalk / exiftool → Wireshark → Volatility → Stego tools (steghide, zsteg)"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Learn 1 tool deeply → Solve 2 forensics challenges using it"
                }
            ]
        },
        visual:
        {
            "title": "🔍 Forensics – visual Learner Roadmap",
            "color": 0x7d638f,
            "fields": [
                {
                    "name": "Best Video Sources",
                    "value": "• John Hammond Forensics solves\n• 13Cubed playlists\n• LiveOverflow\n• Black Hills InfoSec / Antisyphon free webcasts"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Watch 1 tool video → Immediately practice that tool on a PicoCTF or THM challenge"
                }
            ]
        }
    },
    Reverse: {
        book:
        {
            "title": "🧩 Reverse Engineering – Book-then-Apply Roadmap",
            "color": 0x1e1b26,
            "fields": [
                {
                    "name": "Books",
                    "value": "• Free: *Reverse Engineering for Beginners* (Dennis Yurichev)\n• *Practical Malware Analysis* (first half)\n• *Practical Reverse Engineering*"
                },
                {
                    "name": "Practice",
                    "value": "• crackmes.one\n• PicoCTF Reverse\n• Root-Me Reverse\n• Nightmare course (GitHub)\n• Hextree RE challenges\n• Tools: Ghidra + GDB"
                },
                {
                    "name": "Progression",
                    "value": "strings/file → Static (Ghidra) → Dynamic (debugger) → Obfuscation/Unpacking"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Read 1 section + reverse 1–2 simple crackmes"
                }
            ]
        },
        visual:
        {
            "title": "🧩 Reverse Engineering – Visual Learner Roadmap",
            "color": 0x1e1b26,
            "fields": [
                {
                    "name": "Video Playlists",
                    "value": "• LiveOverflow RE series\n• stacksmashing\n• BlackSilence CTF RE Bootcamp\n• pwn.college RE modules\n• CryptoCat / John Hammond RE solves"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Watch Ghidra / technique video → Solve 1–2 matching crackmes or PicoCTF reverse challenges"
                }
            ]
        }
    },
    Pwn: {
        book:
        {
            "title": "💣 Pwn – Book-then-Apply Roadmap",
            "color": 0xc6ff33,
            "fields": [
                {
                    "name": "Books / Guides",
                    "value": "• *Hacking: The Art of Exploitation*\n• Nightmare (GitHub – free book + challenges)\n• Shellcoder’s Handbook concepts"
                },
                {
                    "name": "Practice Platforms",
                    "value": "• OverTheWire (Narnia, Behemoth)\n• pwnable.kr / pwnable.tw\n• ROP Emporium\n• PicoCTF Pwn\n• pwn.college dojo\n• Root-Me Pwn"
                },
                {
                    "name": "Progression",
                    "value": "Stack overflow → NX/ASLR/Canary bypass → ROP → Format string → Heap basics"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Read 1 concept → Solve 1–2 matching pwn challenges with pwntools + GDB"
                }
            ]
        },
        visual:
        {
            "title": "💣 Pwn – Visual Learner Roadmap",
            "color": 0xc6ff33,
            "fields": [
                {
                    "name": "Best Sources",
                    "value": "• pwn.college (best structured videos + dojo)\n• LiveOverflow Binary Exploitation series\n• CryptoCat Pwn walkthroughs"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Watch 1 concept video → Immediately solve the matching challenge on ROP Emporium or pwnable.kr"
                }
            ]
        }
    },
    OSINTandMisc: {
        book:
        {
            "title": "🌐 OSINT / Misc – Book-then-Apply Roadmap",
            "color": 0xbac7da,
            "fields": [
                {
                    "name": "Theory",
                    "value": "• OSINT Framework website\n• Trail of Bits CTF Field Guide (Misc sections)"
                },
                {
                    "name": "Practice",
                    "value": "• PicoCTF OSINT/Misc\n• Free TryHackMe OSINT rooms (OhSINT etc.)\n• Root-Me OSINT/Misc\n• CryptoHack Misc\n• Tools: exiftool, Google dorks, Shodan free tier"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Learn 1 technique → Practice it on 2–3 challenges"
                }
            ]
        },
        visual:
        {
            "title": "🌐 OSINT / Misc – Visual Learner Roadmap",
            "color": 0xbac7da,
            "fields": [
                {
                    "name": "Videos",
                    "value": "• John Hammond OSINT/Misc CTF solves\n• Dedicated OSINT YouTube series"
                },
                {
                    "name": "Example Daily Task",
                    "value": "Watch 1 technique video → Immediately apply it on a PicoCTF or TryHackMe OSINT room"
                }
            ]
        }
    }
}

function get(category, type) {
    const data = roadmapsData[category]?.[type];

    if (!data) {
        return new EmbedBuilder()
            .setTitle('Roadmap not found')
            .setDescription(`No roadmap exists for **${category}** (${type})`)
            .setColor(0xff0000);
    }

    const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description || null)
        .setColor(data.color)
        .setFooter({ text: 'Underdogs Pack • Consistency > Intensity' });

    if (data.fields) {
        data.fields.forEach(field => {
            embed.addFields({ name: field.name, value: field.value, inline: false });
        });
    }

    return embed;
}

module.exports = { get };