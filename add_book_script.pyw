#!/usr/bin/env python3

import os
import gi
import subprocess
from threading import Thread
import re
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, GLib

class AudioArrayGenerator(Gtk.Window):
    def __init__(self):
        Gtk.Window.__init__(self, title="Генератор массива аудио")
        self.set_default_size(700, 600)
        self.cover_path = ""
        self.book_title = ""

        # Тёмная тема
        settings = Gtk.Settings.get_default()
        settings.set_property("gtk-application-prefer-dark-theme", True)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.add(vbox)

        # ID книги
        hbox_id = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_id, False, False, 0)
        label_id = Gtk.Label(label="ID книги:")
        hbox_id.pack_start(label_id, False, False, 0)
        self.id_entry = Gtk.Entry()
        hbox_id.pack_start(self.id_entry, True, True, 0)

        # Название книги
        hbox_title = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_title, False, False, 0)
        label_title = Gtk.Label(label="Название книги:")
        hbox_title.pack_start(label_title, False, False, 0)
        self.title_entry = Gtk.Entry()
        hbox_title.pack_start(self.title_entry, True, True, 0)

        # Обложка
        hbox_cover = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_cover, False, False, 0)
        label_cover = Gtk.Label(label="Обложка:")
        hbox_cover.pack_start(label_cover, False, False, 0)
        self.cover_entry = Gtk.Entry()
        hbox_cover.pack_start(self.cover_entry, True, True, 0)
        cover_button = Gtk.Button(label="Обзор")
        cover_button.connect("clicked", self.on_cover_browse)
        hbox_cover.pack_start(cover_button, False, False, 0)

        # Папка с аудио
        hbox_folder = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_folder, False, False, 0)
        label_folder = Gtk.Label(label="Аудио:")
        hbox_folder.pack_start(label_folder, False, False, 0)
        self.folder_entry = Gtk.Entry()
        self.folder_entry.set_text("audio")
        hbox_folder.pack_start(self.folder_entry, True, True, 0)
        browse_button = Gtk.Button(label="Обзор")
        browse_button.connect("clicked", self.on_browse)
        hbox_folder.pack_start(browse_button, False, False, 0)

        # Файл для вставки (по умолчанию books.js)
        hbox_output = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_output, False, False, 0)
        label_output = Gtk.Label(label="Файл для вставки:")
        hbox_output.pack_start(label_output, False, False, 0)
        self.output_entry = Gtk.Entry()
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_file_path = os.path.join(script_dir, "books.js")
        self.output_entry.set_text(self.output_file_path)
        hbox_output.pack_start(self.output_entry, True, True, 0)
        output_button = Gtk.Button(label="Обзор")
        output_button.connect("clicked", self.on_output_browse)
        hbox_output.pack_start(output_button, False, False, 0)

        # Кнопки действий
        hbox_buttons = Gtk.Box(spacing=6)
        vbox.pack_start(hbox_buttons, False, False, 0)

        generate_button = Gtk.Button(label="Сгенерировать массив")
        generate_button.connect("clicked", self.on_generate)
        hbox_buttons.pack_start(generate_button, True, True, 0)

        insert_button = Gtk.Button(label="Вставить в код")
        insert_button.connect("clicked", self.on_insert)
        hbox_buttons.pack_start(insert_button, True, True, 0)

        # Текстовое поле для массива
        self.textview = Gtk.TextView()
        self.textview.set_wrap_mode(Gtk.WrapMode.WORD)
        self.textbuffer = self.textview.get_buffer()
        scrolled = Gtk.ScrolledWindow()
        scrolled.add(self.textview)
        vbox.pack_start(scrolled, True, True, 0)

    def on_output_browse(self, widget):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dialog = Gtk.FileChooserDialog(
            title="Выберите файл для вставки кода",
            parent=self,
            action=Gtk.FileChooserAction.SAVE,
        )
        dialog.set_current_folder(script_dir)
        dialog.set_current_name("books.js")
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_SAVE, Gtk.ResponseType.OK)
        filter_js = Gtk.FileFilter()
        filter_js.set_name("JavaScript файлы")
        filter_js.add_mime_type("application/javascript")
        filter_js.add_pattern("*.js")
        dialog.add_filter(filter_js)
        if dialog.run() == Gtk.ResponseType.OK:
            self.output_entry.set_text(dialog.get_filename())
            self.output_file_path = dialog.get_filename()
        dialog.destroy()

    def on_browse(self, widget):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dialog = Gtk.FileChooserDialog(
            title="Выберите папку с аудио",
            parent=self,
            action=Gtk.FileChooserAction.SELECT_FOLDER,
        )
        dialog.set_current_folder(script_dir)
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        if dialog.run() == Gtk.ResponseType.OK:
            self.folder_entry.set_text(dialog.get_filename())
        dialog.destroy()

    def on_cover_browse(self, widget):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        dialog = Gtk.FileChooserDialog(
            title="Выберите обложку",
            parent=self,
            action=Gtk.FileChooserAction.OPEN,
        )
        dialog.set_current_folder(script_dir)
        dialog.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                           Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        filter_image = Gtk.FileFilter()
        filter_image.set_name("Изображения")
        filter_image.add_mime_type("image/jpeg")
        filter_image.add_mime_type("image/png")
        dialog.add_filter(filter_image)
        if dialog.run() == Gtk.ResponseType.OK:
            self.cover_entry.set_text(dialog.get_filename())
            self.cover_path = dialog.get_filename()
        dialog.destroy()

    def on_generate(self, widget):
        folder_path = self.folder_entry.get_text()
        if not os.path.isdir(folder_path):
            self.show_error("Выбранная папка не существует!")
            return

        id_text = self.id_entry.get_text().strip()
        if not id_text:
            self.show_error("Введите ID книги!")
            return

        title_text = self.title_entry.get_text().strip()
        if not title_text:
            self.show_error("Введите название книги!")
            return

        cover_file = os.path.basename(self.cover_entry.get_text()) if self.cover_entry.get_text() else ""
        parent_folder = os.path.basename(os.path.dirname(folder_path))
        folder_name = os.path.basename(folder_path)
        full_path = folder_path

        files = sorted(f for f in os.listdir(full_path) if os.path.isfile(os.path.join(full_path, f)))
        if not files:
            self.show_error("Нет аудиофайлов для генерации!")
            return

        array_lines = []
        for idx, f in enumerate(files, 1):
            title = f'Файл {idx}'
            safe_folder = folder_name.replace(" ", "%20").replace("'", "%27")
            safe_parent = parent_folder.replace(" ", "%20").replace("'", "%27")
            file_path = f'{safe_parent}/{folder_name}/{f}'
            array_lines.append(f'        {{ title: "{title}", file: "{file_path}" }}')

        # Формируем объект книги
        output = f"""    {{
        id: "{id_text}",
        title: "{title_text}",
        cover: "img/{cover_file}",
        audioFiles: [
{',\n'.join(array_lines)}
        ]
    }}"""

        self.textbuffer.set_text(output)

    def on_insert(self, widget):
        start_iter = self.textbuffer.get_start_iter()
        end_iter = self.textbuffer.get_end_iter()
        new_book_code = self.textbuffer.get_text(start_iter, end_iter, True).strip()

        if not new_book_code:
            self.show_error("Нет сгенерированного кода для вставки!")
            return

        output_file = self.output_entry.get_text().strip()
        if not output_file:
            self.show_error("Укажите файл для вставки!")
            return

        # Если файл не существует — создаём с шаблоном
        if not os.path.exists(output_file):
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("""const books = [
]
""")

        try:
            with open(output_file, 'r+', encoding='utf-8') as f:
                content = f.read()

                # Ищем закрывающую скобку массива ]
                pos = content.rfind(']')
                if pos == -1:
                    # Если нет — перезаписываем как новый массив
                    content = f"""const books = [
{new_book_code}
]
"""
                else:
                    # Проверяем, есть ли перед ] уже элементы
                    before_close = content[:pos].rstrip()
                    if before_close.endswith('}') or before_close.endswith(']'):
                        # Добавляем запятую перед новым элементом
                        new_content = before_close + ',\n' + new_book_code + '\n' + content[pos:]
                    else:
                        # Если массив был пуст — просто вставляем
                        new_content = before_close + '\n' + new_book_code + '\n' + content[pos:]

                # Перезаписываем файл
                f.seek(0)
                f.write(new_content)
                f.truncate()

            self.show_info(f"Код успешно вставлен в {output_file}")

        except Exception as e:
            self.show_error(f"Ошибка при записи в файл: {str(e)}")

    def show_error(self, message):
        dialog = Gtk.MessageDialog(parent=self, flags=0,
                                   message_type=Gtk.MessageType.ERROR,
                                   buttons=Gtk.ButtonsType.OK,
                                   text=message)
        dialog.run()
        dialog.destroy()

    def show_info(self, message):
        dialog = Gtk.MessageDialog(parent=self, flags=0,
                                   message_type=Gtk.MessageType.INFO,
                                   buttons=Gtk.ButtonsType.OK,
                                   text=message)
        dialog.run()
        dialog.destroy()

if __name__ == "__main__":
    win = AudioArrayGenerator()
    win.connect("destroy", Gtk.main_quit)
    win.show_all()
    Gtk.main()