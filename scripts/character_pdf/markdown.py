"""Small, escaped Markdown subset matching the character-sheet app renderer.

Only our own ReportLab paragraph tags are emitted. Authored HTML is escaped,
and Markdown images never perform a URL fetch; approved media arrives through
the canonical snapshot's separately sanitized PNG map.
"""
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from xml.sax.saxutils import escape, quoteattr


INLINE = re.compile(
    r'(?P<image>!\[(?P<alt>[^\]]*)\]\([^\n)]*\))'
    r'|(?P<link>\[(?P<label>[^\]]+)\]\((?P<url>[^\s)]+)\))'
    r'|`(?P<code>[^`]+)`'
    r'|\*\*(?P<strong>[^*]+)\*\*'
    r'|__(?P<strong_under>[^_]+)__'
    r'|~~(?P<strike>[^~]+)~~'
    r'|\+\+(?P<underline>[^+]+)\+\+'
    r'|(?<!\*)\*(?P<emphasis>[^*]+)\*(?!\*)'
    r'|(?<!\w)_(?P<emphasis_under>[^_]+)_(?!\w)')


def inline(source, size=9.2, depth=0):
    if depth > 8:
        return escape(source)
    output, start = [], 0
    for match in INLINE.finditer(source):
        output.append(escape(source[start:match.start()]))
        groups = match.groupdict()
        if groups['image'] is not None:
            output.append(escape(groups['alt']))
        elif groups['link'] is not None:
            label = inline(groups['label'], size, depth+1)
            url = groups['url']
            parsed = urlsplit(url)
            if parsed.scheme.lower() in ('http', 'https') and parsed.netloc:
                output.append('<link href='+quoteattr(url)+' color="#222222"><u>'+label+'</u></link>')
            else:
                output.append(label)
        elif groups['code'] is not None:
            output.append('<font name="Head">'+escape(groups['code'])+'</font>')
        else:
            field = next(key for key in ('strong', 'strong_under', 'strike', 'underline',
                                         'emphasis', 'emphasis_under') if groups[key] is not None)
            text = inline(groups[field], size, depth+1)
            if field.startswith('strong'):
                output.append('<b>'+text+'</b>')
            elif field.startswith('emphasis'):
                output.append('<i>'+text+'</i>')
            else:
                tag = 'strike' if field == 'strike' else 'u'
                output.append('<'+tag+'>'+text+'</'+tag+'>')
        start = match.end()
    output.append(escape(source[start:]))
    return ''.join(output)


def markdown_html(source, size=9.2):
    """Convert rules/biography Markdown to pagination-safe paragraph markup."""
    lines = str(source or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')
    blocks, paragraph = [], []
    index = 0

    def flush():
        if paragraph:
            blocks.append('<br/>'.join(paragraph))
            paragraph.clear()

    while index < len(lines):
        line = lines[index].strip()
        if not line:
            flush()
            index += 1
            continue
        if line.startswith('```') or line.startswith('~~~'):
            flush()
            fence, code = line[:3], []
            index += 1
            while index < len(lines) and not lines[index].strip().startswith(fence):
                code.append(escape(lines[index]))
                index += 1
            blocks.append('<font name="Head">'+'<br/>'.join(code)+'</font>')
            index += 1
            continue
        heading = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading:
            flush()
            heading_size = size+max(0, 3-len(heading.group(1)))
            blocks.append('<font name="Label" size="'+str(heading_size)+'">'+
                          inline(heading.group(2), heading_size)+'</font>')
            index += 1
            continue
        if re.match(r'^([-*_])(?:\s*\1){2,}$', line):
            flush()
            index += 1
            continue
        # The app's simple pipe-table syntax. Every cell remains readable in
        # narrow folded panels; headings repeat as compact label/value lines.
        if ('|' in line and index+1 < len(lines) and
                re.match(r'^\|?\s*:?-{3,}', lines[index+1].strip())):
            flush()
            headers = [c.strip() for c in line.strip('|').split('|')]
            rows = []
            index += 2
            while index < len(lines) and '|' in lines[index]:
                cells = [c.strip() for c in lines[index].strip().strip('|').split('|')]
                rows.append('; '.join('<b>'+inline(headers[n] if n < len(headers) else 'Value', size)+
                                      ':</b> '+inline(cell, size) for n, cell in enumerate(cells)))
                index += 1
            blocks.append('<br/>'.join(rows) if rows else ' / '.join('<b>'+inline(h, size)+'</b>' for h in headers))
            continue
        item = re.match(r'^[-*+]\s+(.+)$', line)
        ordered = re.match(r'^(\d+)[.)]\s+(.+)$', line)
        if item or ordered:
            flush()
            rows = []
            while index < len(lines):
                current = re.match(r'^[-*+]\s+(.+)$', lines[index].strip()) if item else re.match(r'^(\d+)[.)]\s+(.+)$', lines[index].strip())
                if not current:
                    break
                rows.append(('• ' + inline(current.group(1), size)) if item else
                            (current.group(1)+'. '+inline(current.group(2), size)))
                index += 1
            blocks.append('<br/>'.join(rows))
            continue
        if line.startswith('>'):
            flush()
            quotes = []
            while index < len(lines) and lines[index].strip().startswith('>'):
                quotes.append(inline(lines[index].strip()[1:].strip(), size))
                index += 1
            blocks.append('<i>'+'<br/>'.join(quotes)+'</i>')
            continue
        paragraph.append(inline(line, size))
        index += 1
    flush()
    return '<br/><br/>'.join(blocks)


def markdown_plain(source):
    """Semantic text for source-ledger verification, with Markdown removed."""
    class Plain(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.parts = []

        def handle_starttag(self, tag, attrs):
            if tag == 'br':
                self.parts.append('\n')

        def handle_data(self, data):
            self.parts.append(data)
    parser = Plain()
    parser.feed(markdown_html(source))
    return ''.join(parser.parts)
