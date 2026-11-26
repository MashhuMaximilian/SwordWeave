"""Private PDF export for progression ideas, using the character-sheet fonts."""

from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate

from .markdown import markdown_html
from .renderer import register_fonts


def render(plan, output):
    register_fonts()
    ink = HexColor('#1E2725')
    accent = HexColor('#465F57')
    title = ParagraphStyle('Title', fontName='Head', fontSize=25, leading=30,
                           spaceBefore=15, spaceAfter=17, textColor=ink)
    label = ParagraphStyle('Label', fontName='Label', fontSize=11, leading=15,
                           spaceBefore=14, spaceAfter=4, keepWithNext=True, textColor=accent)
    prose = ParagraphStyle('Body', fontName='Body', fontSize=11, leading=17, spaceAfter=8, textColor=ink)
    story = [
        Paragraph('SwordWeave progression plan', label),
        Paragraph(escape(plan['title']), title),
        Paragraph('Ideas to discuss with your DM before acquiring them.', prose),
    ]
    for index, idea in enumerate(plan['ideas'], 1):
        story.append(Paragraph(f'Idea {index}', label))
        story.append(Paragraph(markdown_html(idea, prose.fontSize), prose))

    def footer(canvas, document):
        canvas.setFont('Label', 9)
        canvas.setFillColor(accent)
        canvas.drawRightString(A4[0] - document.rightMargin, 34, str(document.page))

    document = SimpleDocTemplate(str(output), pagesize=A4, title=plan['title'], author='SwordWeave',
                                 leftMargin=64, rightMargin=64, topMargin=52, bottomMargin=54)
    document.build(story, onFirstPage=footer, onLaterPages=footer)
