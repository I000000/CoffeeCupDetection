import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
import os


# Регистрируем русские шрифты для корректного отображения кириллицы
def register_russian_fonts():
    """Регистрируем шрифты, поддерживающие кириллицу"""
    try:
        # Пробуем зарегистрировать стандартный шрифт, поддерживающий кириллицу
        # В Windows обычно есть Arial
        pdfmetrics.registerFont(TTFont('Arial', 'arial.ttf'))
        pdfmetrics.registerFont(TTFont('Arial-Bold', 'arialbd.ttf'))
        return 'Arial'
    except:
        try:
            # Если Arial не найден, пробуем DejaVu (кросс-платформенный)
            # Нужно скачать и установить DejaVu fonts
            pdfmetrics.registerFont(TTFont('DejaVu', 'DejaVuSans.ttf'))
            pdfmetrics.registerFont(TTFont('DejaVu-Bold', 'DejaVuSans-Bold.ttf'))
            return 'DejaVu'
        except:
            # Используем встроенный шрифт Helvetica (ограниченная поддержка кириллицы)
            return 'Helvetica'


def get_russian_styles():
    """Создаем стили с русскими шрифтами"""
    # Регистрируем шрифты
    font_name = register_russian_fonts()

    # Получаем стандартные стили
    styles = getSampleStyleSheet()

    # Создаем свои стили с русскими шрифтами
    styles.add(ParagraphStyle(
        name='RussianTitle',
        parent=styles['Title'],
        fontName=f'{font_name}-Bold' if font_name != 'Helvetica' else 'Helvetica-Bold',
        fontSize=16,
        alignment=1,  # Center
        spaceAfter=30
    ))

    styles.add(ParagraphStyle(
        name='RussianHeading1',
        parent=styles['Heading1'],
        fontName=f'{font_name}-Bold' if font_name != 'Helvetica' else 'Helvetica-Bold',
        fontSize=14,
        spaceAfter=12
    ))

    styles.add(ParagraphStyle(
        name='RussianHeading2',
        parent=styles['Heading2'],
        fontName=f'{font_name}-Bold' if font_name != 'Helvetica' else 'Helvetica-Bold',
        fontSize=12,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name='RussianNormal',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10,
        leading=12
    ))

    styles.add(ParagraphStyle(
        name='RussianTableHeader',
        parent=styles['Normal'],
        fontName=f'{font_name}-Bold' if font_name != 'Helvetica' else 'Helvetica-Bold',
        fontSize=9,
        textColor=colors.white,
        alignment=1
    ))

    styles.add(ParagraphStyle(
        name='RussianTableCell',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=8,
        alignment=1
    ))

    return styles, font_name


def generate_excel_report(records) -> str:
    """Сгенерировать отчет в Excel"""

    # Преобразуем записи в DataFrame
    data = []
    for record in records:
        # Убедимся, что значения являются числами
        objects_count = float(record.objects_count) if record.objects_count is not None else 0
        avg_count = float(record.average_count) if record.average_count is not None else ""
        processing_time = float(record.processing_time) if record.processing_time is not None else 0

        data.append({
            "ID": record.id,
            "Файл": record.filename,
            "Тип": record.file_type,
            "Количество": objects_count,
            "Среднее (видео)": avg_count,
            "Время обработки (с)": f"{processing_time:.2f}",
            "Дата": record.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        })

    df = pd.DataFrame(data)

    # Создаем Excel файл
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"reports/coffee_report_{timestamp}.xlsx"
    os.makedirs("reports", exist_ok=True)

    with pd.ExcelWriter(report_path, engine='openpyxl') as writer:
        # Основной лист с данными
        df.to_excel(writer, sheet_name='Детекция', index=False)

        # Автонастройка ширины столбцов
        worksheet = writer.sheets['Детекция']
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width

        # Добавляем сводную таблицу только если есть данные
        if not df.empty and len(df) > 0:
            try:
                # Конвертируем числовые столбцы
                df_numeric = df.copy()
                df_numeric['Количество'] = pd.to_numeric(df_numeric['Количество'], errors='coerce')
                df_numeric['Время обработки (с)'] = pd.to_numeric(
                    df_numeric['Время обработки (с)'].str.replace(',', '.'),
                    errors='coerce'
                )

                summary = df_numeric.groupby('Тип').agg({
                    'Количество': ['count', 'mean', 'sum'],
                    'Время обработки (с)': 'mean'
                }).round(2)

                # Переименовываем колонки для читаемости
                summary.columns = ['Количество записей', 'Среднее кол-во', 'Всего объектов', 'Среднее время']
                summary.to_excel(writer, sheet_name='Сводка')

                # Автонастройка ширины столбцов для сводки
                worksheet_summary = writer.sheets['Сводка']
                for column in worksheet_summary.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 30)
                    worksheet_summary.column_dimensions[column_letter].width = adjusted_width

            except Exception as e:
                print(f"Ошибка при создании сводки: {e}")
                # Если сводка не получается, просто пропускаем её

    return report_path


def generate_pdf_report(records) -> str:
    """Сгенерировать отчет в PDF"""

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"reports/coffee_report_{timestamp}.pdf"
    os.makedirs("reports", exist_ok=True)

    # Получаем стили с русскими шрифтами
    styles, font_name = get_russian_styles()

    doc = SimpleDocTemplate(
        report_path,
        pagesize=letter,
        rightMargin=inch * 0.5,
        leftMargin=inch * 0.5,
        topMargin=inch * 0.5,
        bottomMargin=inch * 0.5
    )
    story = []

    # Заголовок
    title = Paragraph("Отчет по подсчету кофейных чашек", styles['RussianTitle'])
    story.append(title)

    # Информация о генерации
    gen_date = Paragraph(f"Сгенерировано: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['RussianNormal'])
    story.append(gen_date)
    story.append(Spacer(1, 12))

    # Статистика
    total_records = len(records)
    total_objects = 0
    total_processing_time = 0

    for record in records:
        try:
            objects_count = float(record.objects_count) if record.objects_count is not None else 0
            processing_time = float(record.processing_time) if record.processing_time is not None else 0
            total_objects += objects_count
            total_processing_time += processing_time
        except (ValueError, TypeError):
            continue

    avg_processing = total_processing_time / total_records if total_records > 0 else 0

    stats_text = f"""
    <b>Всего записей:</b> {total_records}<br/>
    <b>Всего обнаружено объектов:</b> {total_objects}<br/>
    <b>Среднее время обработки:</b> {avg_processing:.2f} секунд<br/>
    """
    stats = Paragraph(stats_text, styles['RussianNormal'])
    story.append(stats)
    story.append(Spacer(1, 20))

    # Таблица с данными
    if records:
        # Заголовки таблицы
        table_data = [
            [
                Paragraph("ID", styles['RussianTableHeader']),
                Paragraph("Файл", styles['RussianTableHeader']),
                Paragraph("Тип", styles['RussianTableHeader']),
                Paragraph("Кол-во", styles['RussianTableHeader']),
                Paragraph("Время (с)", styles['RussianTableHeader']),
                Paragraph("Дата", styles['RussianTableHeader'])
            ]
        ]

        # Данные таблицы
        for record in records[:30]:  # Ограничиваем 30 записями для PDF
            try:
                objects_count = float(record.objects_count) if record.objects_count is not None else 0
                processing_time = float(record.processing_time) if record.processing_time is not None else 0

                # Форматируем дату
                record_date = record.timestamp.strftime("%d.%m.%Y %H:%M")

                table_data.append([
                    Paragraph(str(record.id), styles['RussianTableCell']),
                    Paragraph(record.filename[:15] + "..." if len(record.filename) > 15 else record.filename,
                              styles['RussianTableCell']),
                    Paragraph(record.file_type, styles['RussianTableCell']),
                    Paragraph(str(objects_count), styles['RussianTableCell']),
                    Paragraph(f"{processing_time:.2f}", styles['RussianTableCell']),
                    Paragraph(record_date, styles['RussianTableCell'])
                ])
            except (ValueError, TypeError):
                continue

        if len(table_data) > 1:  # Если есть данные кроме заголовка
            # Создаем таблицу с автоматическим расчетом ширины колонок
            table = Table(table_data,
                          colWidths=[0.5 * inch, 1.5 * inch, 0.7 * inch, 0.7 * inch, 0.8 * inch, 1.2 * inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), font_name if font_name != 'Helvetica' else 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#D9E1F2')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#5B9BD5')),
                ('FONTNAME', (0, 1), (-1, -1), font_name),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
            ]))

            story.append(table)

            if len(records) > 30:
                story.append(Spacer(1, 10))
                note = Paragraph(
                    f"<i>Показано 30 из {len(records)} записей. Для полного отчета используйте Excel-формат.</i>",
                    styles['RussianNormal'])
                story.append(note)
        else:
            no_data = Paragraph("Нет данных для отображения", styles['RussianNormal'])
            story.append(no_data)

    # Добавляем разрыв страницы если нужно
    story.append(Spacer(1, 20))

    # Информация о системе
    sys_info = Paragraph(
        f"<b>Отчет сгенерирован системой Coffee Cup Counter</b><br/>"
        f"Всего обработано записей: {total_records}<br/>"
        f"Общее количество обнаруженных чашек: {total_objects}",
        styles['RussianNormal']
    )
    story.append(sys_info)

    # Создаем PDF
    doc.build(story)

    return report_path
